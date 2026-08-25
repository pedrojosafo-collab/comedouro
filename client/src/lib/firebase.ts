// Direção Casa Serena: integração invisível e confiável; o painel sempre comunica estado, latência e falha de conexão.
import { getDatabase, onValue, push, ref, set, update } from "firebase/database";
import { initializeApp } from "firebase/app";

export const FIREBASE_DATABASE_URL = "https://comedouro-a8211-default-rtdb.firebaseio.com";
export const DEFAULT_DEVICE_ID = "esp32-001";

const app = initializeApp({
  projectId: "comedouro-a8211",
  databaseURL: FIREBASE_DATABASE_URL,
});

export const database = getDatabase(app);

export type FeederStatus = {
  status: "online" | "offline" | "unknown";
  lastSeen: number | null;
  foodLevel: number | null;
  wifi: number | null;
  servo: string | null;
  lastFeed: number | null;
  firmware: string | null;
  raw: Record<string, unknown>;
};

export type Schedule = {
  id: string;
  time: string;
  quantity: number;
  repetitions: number;
  enabled: boolean;
  createdAt: number;
};

export type FeedEvent = {
  id: string;
  quantity: number;
  type: "manual" | "scheduled" | "unknown";
  status: "success" | "failed" | "pending" | "unknown";
  timestamp: number;
};

const asNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function subscribeToDevice(deviceId: string, callback: (status: FeederStatus) => void) {
  return onValue(ref(database, `devices/${deviceId}`), (snapshot) => {
    const raw = (snapshot.val() ?? {}) as Record<string, unknown>;
    const statusRaw = (raw.status ?? {}) as Record<string, unknown>;
    const lastSeen = asNumber(statusRaw.lastSeen ?? raw.lastSeen ?? raw.timestamp);
    const age = lastSeen !== null ? Date.now() - lastSeen : Number.POSITIVE_INFINITY;
    // O status salvo no Firebase não é suficiente: somente um heartbeat recente
    // prova que o ESP32 ainda está comunicando.
    const isFresh = age >= 0 && age < 90_000;
    callback({
      status: isFresh ? "online" : lastSeen !== null ? "offline" : "unknown",
      lastSeen,
      foodLevel: asNumber(statusRaw.foodLevel ?? raw.foodLevel ?? raw.food ?? raw.level),
      wifi: asNumber(statusRaw.wifi ?? raw.wifi ?? raw.rssi),
      servo: statusRaw.servo ? String(statusRaw.servo) : raw.servo ? String(raw.servo) : null,
      lastFeed: asNumber(statusRaw.lastFeed ?? raw.lastFeed),
      firmware: statusRaw.firmware ? String(statusRaw.firmware) : raw.firmware ? String(raw.firmware) : null,
      raw,
    });
  });
}

export function subscribeToSchedules(deviceId: string, callback: (items: Schedule[]) => void) {
  return onValue(ref(database, `devices/${deviceId}/schedules`), (snapshot) => {
    const raw = snapshot.val() ?? {};
    const items = Object.entries(raw as Record<string, Record<string, unknown>>).map(([id, value]) => ({
      id,
      time: String(value.time ?? "08:00"),
      quantity: asNumber(value.quantity) ?? 50,
      repetitions: asNumber(value.repetitions) ?? 1,
      enabled: value.enabled !== false,
      createdAt: asNumber(value.createdAt) ?? Date.now(),
    }));
    callback(items.sort((a, b) => a.time.localeCompare(b.time)));
  });
}

export function subscribeToHistory(deviceId: string, callback: (items: FeedEvent[]) => void) {
  return onValue(ref(database, `devices/${deviceId}/history`), (snapshot) => {
    const raw = snapshot.val() ?? {};
    const items = Object.entries(raw as Record<string, Record<string, unknown>>).map(([id, value]) => ({
      id,
      quantity: asNumber(value.quantity) ?? 0,
      type: (value.type === "manual" || value.type === "scheduled" ? value.type : "unknown") as FeedEvent["type"],
      status: (value.status === "success" || value.status === "failed" || value.status === "pending" ? value.status : "unknown") as FeedEvent["status"],
      timestamp: asNumber(value.timestamp) ?? Date.now(),
    }));
    callback(items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 12));
  });
}

export async function sendFeedCommand(deviceId: string, quantity: number, repetitions = 1) {
  const commandRef = push(ref(database, `devices/${deviceId}/commands`));
  await set(commandRef, { type: "feed", quantity, repetitions, source: "web", status: "pending", createdAt: Date.now() });
  return commandRef.key;
}

export async function saveSchedule(deviceId: string, schedule: Omit<Schedule, "id" | "createdAt">) {
  const scheduleRef = push(ref(database, `devices/${deviceId}/schedules`));
  await set(scheduleRef, { ...schedule, createdAt: Date.now() });
}

export async function updateSchedule(deviceId: string, scheduleId: string, patch: Partial<Schedule>) {
  await update(ref(database, `devices/${deviceId}/schedules/${scheduleId}`), patch);
}

export async function removeSchedule(deviceId: string, scheduleId: string) {
  await set(ref(database, `devices/${deviceId}/schedules/${scheduleId}`), null);
}

export type CommandStatus = "pending" | "processing" | "success" | "failed" | "unknown";

export function subscribeToCommand(deviceId: string, commandId: string, callback: (status: CommandStatus) => void) {
  return onValue(ref(database, `devices/${deviceId}/commands/${commandId}`), (snapshot) => {
    const raw = (snapshot.val() ?? {}) as Record<string, unknown>;
    const value = String(raw.status ?? "unknown").toLowerCase();
    callback(value === "pending" || value === "processing" || value === "success" || value === "failed" ? value : "unknown");
  });
}

export function waitForCommandResult(deviceId: string, commandId: string, timeoutMs = 20_000): Promise<"success" | "failed" | "timeout"> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: "success" | "failed" | "timeout") => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      resolve(result);
    };
    const unsubscribe = onValue(ref(database, `devices/${deviceId}/commands/${commandId}`), (snapshot) => {
      const raw = (snapshot.val() ?? {}) as Record<string, unknown>;
      const value = String(raw.status ?? "").toLowerCase();
      if (value === "success") finish("success");
      else if (value === "failed") finish("failed");
    });
    timer = setTimeout(() => finish("timeout"), timeoutMs);
  });
}

