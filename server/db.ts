import type {
  User,
  InsertUser,
  Device,
  Schedule,
  Feeding,
  Collaborator,
} from "../drizzle/schema";

const firebaseUrl = (process.env.FIREBASE_DATABASE_URL || "").replace(
  /\/$/,
  "",
);
const firebaseSecret = process.env.FIREBASE_DATABASE_SECRET || "";

function authSuffix() {
  return firebaseSecret ? `?auth=${encodeURIComponent(firebaseSecret)}` : "";
}

async function firebaseRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T | undefined> {
  if (!firebaseUrl) throw new Error("FIREBASE_DATABASE_URL não configurado.");
  const response = await fetch(`${firebaseUrl}/${path}.json${authSuffix()}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Firebase ${response.status}: ${body}`);
  }
  if (response.status === 204) return undefined;
  return (await response.json()) as T;
}

const now = () => new Date();
const toDate = (v: unknown): Date | null => {
  if (v == null) return null;

  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v;
  }

  if (typeof v === "number") {
    const date = new Date(v);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof v === "string") {
    const trimmed = v.trim();

    if (!trimmed) return null;

    // Timestamp em string
    if (/^\d+$/.test(trimmed)) {
      const date = new Date(Number(trimmed));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

function nextId(items: Record<string, unknown> | null | undefined) {
  const nums = Object.keys(items || {})
    .map(Number)
    .filter(Number.isFinite);
  return String((nums.length ? Math.max(...nums) : 0) + 1);
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required");
  }

  const existing = await getUserByOpenId(user.openId);

  const id =
    existing?.id ??
    Number((await firebaseRequest<string>("meta/nextUserId")) || "1");

  const actualId = existing?.id ?? id;

  if (!existing) {
    await firebaseRequest("meta/nextUserId", {
      method: "PUT",
      body: JSON.stringify(actualId + 1),
    });
  }

  const record = {
    id: actualId,
    openId: user.openId,

    // IMPORTANTE:
    // Se não vier e-mail novo, mantém o e-mail antigo.
    name: user.name ?? existing?.name ?? null,
    email: user.email ?? existing?.email ?? null,
    loginMethod: user.loginMethod ?? existing?.loginMethod ?? null,

    role:
      user.role ??
      existing?.role ??
      (user.openId === (process.env.OWNER_OPEN_ID || "") ? "admin" : "user"),

    createdAt: existing?.createdAt?.toISOString?.() ?? now().toISOString(),

    updatedAt: now().toISOString(),

    lastSignedIn: (user.lastSignedIn ?? now()).toISOString(),
  };

  await firebaseRequest(`users/${encodeURIComponent(user.openId)}`, {
    method: "PUT",
    body: JSON.stringify(record),
  });
}

export async function getUserByOpenId(
  openId: string,
): Promise<User | undefined> {
  const value = await firebaseRequest<any>(
    `users/${encodeURIComponent(openId)}`,
  );
  if (!value) return undefined;
  return {
    ...value,
    createdAt: toDate(value.createdAt)!,
    updatedAt: toDate(value.updatedAt)!,
    lastSignedIn: toDate(value.lastSignedIn)!,
  } as User;
}

export async function getDb() {
  return true;
}

async function getCollection<T>(name: string): Promise<Record<string, T>> {
  return (await firebaseRequest<Record<string, T>>(name)) || {};
}

async function putCollectionItem(
  name: string,
  id: string | number,
  value: unknown,
) {
  await firebaseRequest(`${name}/${id}`, {
    method: "PUT",
    body: JSON.stringify(value),
  });
}

function normalizeDevice(v: any): Device {
  if (!v || v.id == null) {
    throw new Error("Dispositivo inválido no Firebase.");
  }
  return {
    ...v,
    id: Number(v.id),
    ownerId: Number(v.ownerId),
    lastSeen: toDate(v.lastSeen),
    lastFeeding: toDate(v.lastFeeding),
    createdAt: toDate(v.createdAt)!,
  } as Device;
}
function normalizeSchedule(v: any): Schedule | null {
  if (!v || typeof v !== "object") {
    return null;
  }

  const id = Number(v.id);
  const deviceId = Number(v.deviceId);

  if (!Number.isFinite(id) || !Number.isFinite(deviceId)) {
    return null;
  }

  return {
    ...v,
    id,
    deviceId,
    createdAt: toDate(v.createdAt) ?? now(),
  } as Schedule;
}
function normalizeFeeding(v: any): Feeding {
  return {
    ...v,
    id: Number(v.id),
    deviceId: Number(v.deviceId),
    createdAt: toDate(v.createdAt)!,
  } as Feeding;
}
function normalizeCollaborator(v: any): Collaborator {
  const createdAt = toDate(v?.createdAt);

  if (
    !v ||
    !Number.isFinite(Number(v.id)) ||
    !Number.isFinite(Number(v.deviceId)) ||
    !createdAt
  ) {
    throw new Error("Colaborador inválido");
  }

  return {
    ...v,
    id: Number(v.id),
    deviceId: Number(v.deviceId),
    createdAt,
  } as Collaborator;
}

export async function getOwnedOrSharedDevice(
  userId: number,
  deviceId?: number,
) {
  const devices = Object.values(await getCollection<any>("devices"))
    .filter((value: any) => value && value.id != null)
    .map(normalizeDevice);

  const owned = devices.find(
    (d) => d.ownerId === userId && (!deviceId || d.id === deviceId),
  );

  if (owned) {
    return owned;
  }

  const user = await getUserByNumericId(userId);

  if (!user?.email) {
    return undefined;
  }

  const userEmail = user.email.trim().toLowerCase();

  const collaborators = Object.values(await getCollection<any>("collaborators"))
    .filter((item: any) => item && typeof item.email === "string")
    .map(normalizeCollaborator);

  const shared = collaborators.find(
    (c) =>
      c.email.trim().toLowerCase() === userEmail &&
      (!deviceId || c.deviceId === deviceId),
  );

  if (!shared) {
    return undefined;
  }

  return devices.find((d) => d.id === shared.deviceId);
}

async function getUserByNumericId(id: number): Promise<User | undefined> {
  const users = Object.values(await getCollection<any>("users"));
  const found = users.find((u: any) => Number(u.id) === id);
  return found
    ? ({
        ...found,
        createdAt: toDate(found.createdAt)!,
        updatedAt: toDate(found.updatedAt)!,
        lastSignedIn: toDate(found.lastSignedIn)!,
      } as User)
    : undefined;
}

export async function getDevicesForUser(
  userId: number,
  email?: string,
): Promise<Device[]> {
  const devices = Object.values(await getCollection<any>("devices"))
    .filter((value: any) => value && value.id != null)
    .map(normalizeDevice);

  const owned = devices.filter((d) => d.ownerId === userId);

  // Se o e-mail não veio na sessão,
  // tenta recuperar diretamente do Firebase.
  let userEmail = email?.trim().toLowerCase() || "";

  if (!userEmail) {
    const user = await getUserByNumericId(userId);

    if (user?.email) {
      userEmail = user.email.trim().toLowerCase();
    }
  }

  // Sem e-mail não há como localizar compartilhamentos
  // antigos baseados em e-mail.
  if (!userEmail) {
    return owned;
  }

  const collaborators = Object.values(await getCollection<any>("collaborators"))
    .filter(
      (item: any) =>
        item && typeof item.email === "string" && item.email.trim().length > 0,
    )
    .map(normalizeCollaborator);

  const sharedIds = new Set(
    collaborators
      .filter((c) => c.email.trim().toLowerCase() === userEmail)
      .map((c) => c.deviceId),
  );

  return [
    ...owned,

    ...devices.filter(
      (d) => sharedIds.has(d.id) && !owned.some((o) => o.id === d.id),
    ),
  ];
}

export async function getDeviceSchedules(
  deviceId: number,
): Promise<Schedule[]> {
  const items = await getCollection<any>("schedules");

  return Object.values(items)
    .map(normalizeSchedule)
    .filter((s): s is Schedule => s !== null && s.deviceId === deviceId)
    .sort((a, b) => a.hour - b.hour || a.minute - b.minute);
}

export async function getDeviceFeedings(deviceId: number): Promise<Feeding[]> {
  return Object.values(await getCollection<any>("feedings"))
    .map(normalizeFeeding)
    .filter((f) => f.deviceId === deviceId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 100);
}

export async function getDeviceCollaborators(
  deviceId: number,
): Promise<Collaborator[]> {
  const items = await getCollection<any>("collaborators");

  if (!items || typeof items !== "object") {
    return [];
  }

  return Object.values(items)
    .filter((item: any) => item && Number(item.deviceId) === deviceId)
    .map(
      (item: any) =>
        ({
          ...item,
          id: Number(item.id),
          deviceId: Number(item.deviceId),
          createdAt: toDate(item.createdAt) ?? new Date(),
        }) as Collaborator,
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getDeviceById(id: number): Promise<Device | undefined> {
  const value = await firebaseRequest<any>(`devices/${id}`);
  return value ? normalizeDevice(value) : undefined;
}

export async function createDevice(input: {
  deviceId: string;
  ownerId: number;
  name: string;
  deviceKey: string;
}) {
  const devices = await getCollection<any>("devices");
  const id = Number(nextId(devices));
  const record = {
    id,
    deviceId: input.deviceId,
    ownerId: input.ownerId,
    name: input.name,
    deviceKey: input.deviceKey,
    status: "offline",
    wifi: null,
    lastSeen: null,
    lastFeeding: null,
    createdAt: now().toISOString(),
  };
  await putCollectionItem("devices", id, record);
  return normalizeDevice(record);
}

export async function updateDevice(id: number, patch: Partial<Device>) {
  const current = await getDeviceById(id);

  if (!current) {
    throw new Error("Device not found");
  }

  const lastSeen =
    patch.lastSeen instanceof Date
      ? patch.lastSeen.toISOString()
      : patch.lastSeen != null
        ? new Date(patch.lastSeen).toISOString()
        : current.lastSeen
          ? current.lastSeen.toISOString()
          : null;

  const lastFeeding =
    patch.lastFeeding instanceof Date
      ? patch.lastFeeding.toISOString()
      : patch.lastFeeding != null
        ? new Date(patch.lastFeeding).toISOString()
        : current.lastFeeding
          ? current.lastFeeding.toISOString()
          : null;

  const createdAt =
    current.createdAt instanceof Date &&
    !Number.isNaN(current.createdAt.getTime())
      ? current.createdAt.toISOString()
      : now().toISOString();

  const record = {
    ...current,
    ...patch,
    id,
    lastSeen,
    lastFeeding,
    createdAt,
  };

  await putCollectionItem("devices", id, record);

  return normalizeDevice(record);
}

export async function createSchedule(
  input: Omit<Schedule, "id" | "createdAt">,
) {
  const items = await getCollection<any>("schedules");
  const id = Number(nextId(items));
  const record = { ...input, id, createdAt: now().toISOString() };
  await putCollectionItem("schedules", id, record);
  return normalizeSchedule(record);
}
export async function updateSchedule(id: number, patch: Partial<Schedule>) {
  const items = await getCollection<any>("schedules");
  const cur = items[String(id)];
  if (!cur) throw new Error("Schedule not found");
  const record = { ...cur, ...patch, id };
  await putCollectionItem("schedules", id, record);
  return normalizeSchedule(record);
}
export async function deleteSchedule(id: number) {
  await firebaseRequest(`schedules/${id}`, { method: "DELETE" });
}
export async function createFeeding(input: Omit<Feeding, "id">) {
  const items = await getCollection<any>("feedings");
  const id = Number(nextId(items));
  const record = {
    ...input,
    id,
    createdAt:
      input.createdAt instanceof Date
        ? input.createdAt.toISOString()
        : now().toISOString(),
  };
  await putCollectionItem("feedings", id, record);
  return normalizeFeeding(record);
}
export async function createCollaborator(
  input: Omit<Collaborator, "id" | "createdAt">,
) {
  const items = await getCollection<any>("collaborators");
  const id = Number(nextId(items));
  const record = { ...input, id, createdAt: now().toISOString() };
  await putCollectionItem("collaborators", id, record);
  return normalizeCollaborator(record);
}
export async function deleteCollaborator(id: number) {
  await firebaseRequest(`collaborators/${id}`, { method: "DELETE" });
}

export { getCollection };
