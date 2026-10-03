import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { systemRouter } from "./_core/systemRouter";

/* =========================================================
   FIREBASE
   ========================================================= */

const firebaseUrl = (
  process.env.FIREBASE_DATABASE_URL ||
  "https://comedouro-a8211-default-rtdb.firebaseio.com"
).replace(/\/$/, "");

const firebaseSecret = process.env.FIREBASE_DATABASE_SECRET || "";

function firebaseQuery(): string {
  return firebaseSecret ? `?auth=${encodeURIComponent(firebaseSecret)}` : "";
}

/* =========================================================
   FIREBASE PUT
   ========================================================= */

async function firebaseWrite(path: string, value: unknown) {
  try {
    const url = `${firebaseUrl}/${path}.json${firebaseQuery()}`;

    console.log(`[Firebase PUT] Enviando dados para: ${path}`);

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(value),
    });

    const body = await response.text().catch(() => "");

    console.log(`[Firebase PUT] HTTP ${response.status}`);

    if (!response.ok) {
      console.error(`[Firebase] PUT ${path} -> ${response.status}: ${body}`);
    }

    return {
      synced: response.ok,
      status: response.status,
      body,
    };
  } catch (error) {
    console.error(`[Firebase] PUT ${path} failed`, error);

    return {
      synced: false,
      status: 0,
      body: "",
    };
  }
}

/* =========================================================
   FIREBASE PATCH
   ========================================================= */

async function firebasePatch(path: string, value: unknown) {
  try {
    const url = `${firebaseUrl}/${path}.json${firebaseQuery()}`;

    console.log(`[Firebase PATCH] Atualizando: ${path}`);

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(value),
    });

    const body = await response.text().catch(() => "");

    console.log(`[Firebase PATCH] HTTP ${response.status}`);

    if (!response.ok) {
      console.error(`[Firebase] PATCH ${path} -> ${response.status}: ${body}`);
    }

    return {
      synced: response.ok,
      status: response.status,
      body,
    };
  } catch (error) {
    console.error(`[Firebase] PATCH ${path} failed`, error);

    return {
      synced: false,
      status: 0,
      body: "",
    };
  }
}

/* =========================================================
   FIREBASE GET
   ========================================================= */

async function firebaseRead<T>(path: string): Promise<T | undefined> {
  try {
    const url = `${firebaseUrl}/${path}.json${firebaseQuery()}`;

    console.log(`[Firebase GET] Consultando: ${path}`);

    const response = await fetch(url);
    const body = await response.text().catch(() => "");

    console.log(`[Firebase GET] HTTP ${response.status}`);

    if (!response.ok) {
      console.error(`[Firebase] GET ${path} -> ${response.status}`);

      return undefined;
    }

    if (!body || body === "null") {
      return undefined;
    }

    return JSON.parse(body) as T;
  } catch (error) {
    console.error(`[Firebase] GET ${path} failed`, error);

    return undefined;
  }
}

/* =========================================================
   FIREBASE DELETE
   ========================================================= */

async function firebaseDelete(path: string) {
  try {
    const url = `${firebaseUrl}/${path}.json${firebaseQuery()}`;

    const response = await fetch(url, {
      method: "DELETE",
    });

    const body = await response.text().catch(() => "");

    console.log(`[Firebase DELETE] ${path} -> ${response.status}`, body);

    return response.ok;
  } catch (error) {
    console.error(`[Firebase] DELETE ${path} failed`, error);

    return false;
  }
}

/* =========================================================
   FIREBASE DEVICE PATH
   ========================================================= */

function firebaseDevicePath(deviceId: number): string {
  return `devices/${deviceId}`;
}

/* =========================================================
   SCHEMAS
   ========================================================= */

export const deviceInput = z.object({
  deviceId: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/),

  name: z.string().min(2).max(120),

  type: z.enum(["feeder", "water-monitor"]).default("feeder"),
});

export const scheduleInput = z.object({
  deviceId: z.number(),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  quantity: z.number().int().min(1).max(10).default(1),
});

/* =========================================================
   DEVICE ACCESS
   ========================================================= */

async function requireDevice(
  user: {
    id: number;
    email?: string | null;
    openId?: string;
  },
  deviceId: number,
) {
  const device = await db.getDeviceById(deviceId);

  if (!device) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Dispositivo não encontrado.",
    });
  }

  if (device.ownerId === user.id) {
    return {
      device,
      canManage: true,
    };
  }

  let userEmail = user.email?.trim().toLowerCase() || "";

  if (!userEmail) {
    const savedUser = await db.getUserByNumericId(user.id);

    if (savedUser?.email) {
      userEmail = savedUser.email.trim().toLowerCase();
    }
  }

  if (!userEmail) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Seu usuário não possui um e-mail cadastrado.",
    });
  }

  const collaborators = await db.getDeviceCollaborators(deviceId);

  const shared = collaborators.find(
    (c) =>
      typeof c.email === "string" && c.email.trim().toLowerCase() === userEmail,
  );

  if (!shared) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você não tem acesso a este dispositivo.",
    });
  }

  return {
    device,
    canManage: shared.role === "administrator",
  };
}

/* =========================================================
   ROUTER
   ========================================================= */

export const appRouter = router({
  /* =======================================================
     SYSTEM
     ======================================================= */

  system: systemRouter,

  /* =======================================================
     AUTH
     ======================================================= */

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      });

      return {
        success: true,
      } as const;
    }),
  }),

  /* =======================================================
     APP
     ======================================================= */

  app: router({
    /* =====================================================
       OVERVIEW
       ===================================================== */

    overview: protectedProcedure.query(async ({ ctx }) => {
      try {
        console.log("[OVERVIEW] Usuário:", {
          id: ctx.user.id,
          email: ctx.user.email,
          openId: ctx.user.openId,
        });

        const devices = await db.getDevicesForUser(
          ctx.user.id,
          ctx.user.email ?? undefined,
        );

        console.log("[OVERVIEW] Dispositivos encontrados:", devices);

        if (!devices || devices.length === 0) {
          return {
            device: null,
            devices: [],
            waterDevice: null,
            waterSensors: {
              temperature: null,
              conductivity: null,
              ph: null,
              turbidity: null,
            },
            schedules: [],
            feedings: [],
            collaborators: [],
            firebaseConfigured: Boolean(firebaseUrl),
          };
        }

        /* =================================================
             LER TODOS OS DISPOSITIVOS
             ================================================= */

        const devicesWithFirebase = await Promise.all(
          devices.map(async (device) => {
            const firebasePath = firebaseDevicePath(device.id);

            const remote = await firebaseRead<{
              id?: number;
              deviceId?: string;
              deviceKey?: string;
              name?: string;
              type?: string;
              ownerId?: number;
              ownerUid?: string;

              status?: string;
              lastSeen?: number | null;
              lastFeeding?: number | null;
              wifi?: number | null;

              temperature?: number | null;
              conductivity?: number | null;
              ph?: number | null;
              turbidity?: number | null;
            }>(firebasePath);

            const lastSeen = remote?.lastSeen
              ? new Date(remote.lastSeen)
              : device.lastSeen;

            const online = Boolean(
              lastSeen && Date.now() - lastSeen.getTime() < 30000,
            );

            if (lastSeen) {
              await db.updateDevice(device.id, {
                lastSeen,
                wifi: remote?.wifi ?? device.wifi,
                status: online ? "online" : "offline",
              });
            }

            return {
              local: device,
              remote,
              lastSeen,
              online,
            };
          }),
        );

        /* =================================================
             IDENTIFICAR COMEDOURO
             ================================================= */

        // IMPORTANTE: o tipo cadastrado no banco local é a fonte principal.
        // Isso evita que o heartbeat do segundo ESP32 faça o site confundir
        // o monitor de água com o comedouro.
        const feeder =
          devicesWithFirebase.find((item) => item.local.type === "feeder") ??
          devicesWithFirebase.find(
            (item) =>
              item.remote?.type === "feeder" ||
              item.remote?.type === "comedouro" ||
              item.local.deviceId.toLowerCase().includes("comedouro"),
          );

        /* =================================================
             IDENTIFICAR MONITOR DE ÁGUA
             ================================================= */

        const waterDevice =
          devicesWithFirebase.find(
            (item) => item.local.type === "water-monitor",
          ) ??
          devicesWithFirebase.find(
            (item) =>
              item.remote?.type === "water-monitor" ||
              item.local.deviceId.toLowerCase().includes("agua") ||
              item.local.deviceId.toLowerCase().includes("water") ||
              item.local.name.toLowerCase().includes("água") ||
              item.local.name.toLowerCase().includes("agua"),
          );

        /* =================================================
             DADOS DO COMEDOURO
             ================================================= */

        const device = feeder?.local
          ? {
              ...feeder.local,

              lastSeen: feeder.lastSeen,

              wifi: feeder.remote?.wifi ?? feeder.local.wifi,

              status: feeder.online ? "online" : "offline",

              lastFeeding: feeder.remote?.lastFeeding
                ? new Date(feeder.remote.lastFeeding)
                : feeder.local.lastFeeding,
            }
          : null;

        /* =================================================
             SENSORES DA ÁGUA
             ================================================= */

        const waterSensors = waterDevice?.remote
          ? {
              temperature: waterDevice.remote.temperature ?? null,

              conductivity: waterDevice.remote.conductivity ?? null,

              ph: waterDevice.remote.ph ?? null,

              turbidity: waterDevice.remote.turbidity ?? null,

              lastSeen: waterDevice.lastSeen,

              status: waterDevice.online ? "online" : "offline",

              wifi: waterDevice.remote.wifi ?? null,
            }
          : {
              temperature: null,
              conductivity: null,
              ph: null,
              turbidity: null,
              lastSeen: null,
              status: "offline",
              wifi: null,
            };

        /* =================================================
             FIREBASE HISTORY DO COMEDOURO
             ================================================= */

        let remoteHistory:
          | Record<
              string,
              {
                type?: string;
                quantity?: number;
                createdAt?: number | string;
              }
            >
          | undefined;

        if (feeder?.local) {
          remoteHistory = await firebaseRead<
            Record<
              string,
              {
                type?: string;
                quantity?: number;
                createdAt?: number | string;
              }
            >
          >(`${firebaseDevicePath(feeder.local.id)}/history`);
        }

        /* =================================================
             ALIMENTAÇÕES LOCAIS
             ================================================= */

        let localFeedings: Awaited<ReturnType<typeof db.getDeviceFeedings>> =
          [];

        if (feeder?.local) {
          localFeedings = await db.getDeviceFeedings(feeder.local.id);
        }

        /* =================================================
             ALIMENTAÇÕES DO FIREBASE
             ================================================= */

        const remoteAutomatic = Object.entries(remoteHistory ?? {})
          .filter(
            ([, item]) => item.type === "automatic" || item.type === "manual",
          )
          .map(([key, item]) => ({
            id: -Number(key.slice(-8)) || 0,

            deviceId: feeder!.local.id,

            type:
              item.type === "manual"
                ? ("manual" as const)
                : ("automatic" as const),

            quantity: item.quantity ?? 1,

            scheduledTime: null,

            createdAt: new Date(
              item.createdAt !== undefined
                ? Number(item.createdAt)
                : Number(String(key).split("_")[0]),
            ),
          }));

        const feedings = [...localFeedings, ...remoteAutomatic]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 100);

        /* =================================================
             AGENDAMENTOS
             ================================================= */

        let schedules: Awaited<ReturnType<typeof db.getDeviceSchedules>> = [];

        if (feeder?.local) {
          schedules = await db.getDeviceSchedules(feeder.local.id);
        }

        /* =================================================
             COLABORADORES
             ================================================= */

        let collaborators: Awaited<
          ReturnType<typeof db.getDeviceCollaborators>
        > = [];

        if (feeder?.local) {
          collaborators = await db.getDeviceCollaborators(feeder.local.id);
        }

        /* =================================================
             RETORNO
             ================================================= */

        return {
          device,

          devices: devicesWithFirebase.map((item) => ({
            ...item.local,

            status: item.online ? "online" : "offline",

            lastSeen: item.lastSeen,

            type: item.local.type ?? item.remote?.type ?? "feeder",
          })),

          waterDevice: waterDevice?.local
            ? {
                ...waterDevice.local,

                status: waterDevice.online ? "online" : "offline",

                lastSeen: waterDevice.lastSeen,

                type: waterDevice.remote?.type ?? "water-monitor",
              }
            : null,

          waterSensors,

          schedules,
          feedings,
          collaborators,

          firebaseConfigured: Boolean(firebaseUrl),
        };
      } catch (error) {
        console.error("[OVERVIEW] ERRO:", error);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao carregar os dados dos dispositivos.",
          cause: error,
        });
      }
    }),

    /* =====================================================
       ADD DEVICE
       ===================================================== */

    addDevice: protectedProcedure
      .input(deviceInput)
      .mutation(async ({ ctx, input }) => {
        console.log("[DEVICE] Iniciando cadastro:", input);

        const existingDevices = await db.getDevicesForUser(
          ctx.user.id,
          ctx.user.email ?? undefined,
        );

        const existing = existingDevices.find(
          (d) => d.deviceId === input.deviceId,
        );

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Esse ID já está cadastrado.",
          });
        }

        const device = await db.createDevice({
          deviceId: input.deviceId,

          ownerId: ctx.user.id,

          name: input.name,

          deviceKey: randomUUID(),
        });

        console.log("[DEVICE] Retorno createDevice:", device);

        if (!device || !device.id) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",

            message: "Não foi possível criar o dispositivo no banco de dados.",
          });
        }

        const firebasePath = firebaseDevicePath(device.id);

        const firebaseDevice = {
          id: device.id,

          deviceId: device.deviceId,

          deviceKey: device.deviceKey,

          name: device.name,

          type: input.type,

          ownerId: device.ownerId,

          ownerUid: ctx.user.openId,

          status: "offline",

          lastSeen: null,

          lastFeeding: null,

          wifi: null,

          command: null,

          history: null,

          schedules: null,

          temperature: input.type === "water-monitor" ? null : undefined,

          conductivity: input.type === "water-monitor" ? null : undefined,

          ph: input.type === "water-monitor" ? null : undefined,

          turbidity: input.type === "water-monitor" ? null : undefined,
        };

        const sync = await firebaseWrite(firebasePath, firebaseDevice);

        console.log("[DEVICE] Firebase sincronizado:", sync);

        return {
          id: device.id,

          deviceId: device.deviceId,

          name: device.name,

          type: input.type,

          deviceKey: device.deviceKey,

          synced: sync.synced,
        };
      }),

    /* =====================================================
       RENAME DEVICE
       ===================================================== */

    renameDevice: protectedProcedure
      .input(
        z.object({
          deviceId: z.number(),
          name: z.string().min(2).max(120),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const access = await requireDevice(ctx.user, input.deviceId);

        if (!access.canManage) {
          throw new TRPCError({
            code: "FORBIDDEN",
          });
        }

        await db.updateDevice(input.deviceId, {
          name: input.name,
        });

        await firebasePatch(firebaseDevicePath(access.device.id), {
          name: input.name,
        });

        return {
          success: true,
        };
      }),

    /* =====================================================
       FEED NOW
       ===================================================== */

    feedNow: protectedProcedure
      .input(
        z.object({
          deviceId: z.number(),

          quantity: z.number().int().min(1).max(10).default(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const access = await requireDevice(ctx.user, input.deviceId);

        if (access.device.type !== "feeder") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Este dispositivo não é um comedouro.",
          });
        }

        const now = Date.now();

        const requestId = randomUUID();

        const command = {
          requestId,

          feed: true,

          type: "manual",

          quantity: input.quantity,

          requestedAt: now,

          requestedBy: ctx.user.email ?? ctx.user.name ?? "usuário",
        };

        console.log("[FEED] Enviando comando:", command);

        const sync = await firebaseWrite(
          `${firebaseDevicePath(access.device.id)}/command`,
          command,
        );

        if (!sync.synced) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",

            message: "Não foi possível enviar o comando para o Firebase.",
          });
        }

        return {
          success: true,
          synced: true,
          requestId,
        };
      }),

    /* =====================================================
       ADD SCHEDULE
       ===================================================== */

    addSchedule: protectedProcedure
      .input(scheduleInput)
      .mutation(async ({ ctx, input }) => {
        const access = await requireDevice(ctx.user, input.deviceId);

        if (!access.canManage) {
          throw new TRPCError({
            code: "FORBIDDEN",
          });
        }

        const schedule = await db.createSchedule({
          deviceId: input.deviceId,

          hour: input.hour,

          minute: input.minute,

          quantity: input.quantity,

          active: true,
        });

        const rows = await db.getDeviceSchedules(input.deviceId);

        const firebaseSchedules = Object.fromEntries(
          rows.map((s) => [
            String(s.id),
            {
              hour: s.hour,

              minute: s.minute,

              quantity: s.quantity,

              active: s.active,
            },
          ]),
        );

        await firebasePatch(firebaseDevicePath(access.device.id), {
          schedules: firebaseSchedules,
        });

        return {
          id: schedule.id,
        };
      }),

    /* =====================================================
       TOGGLE SCHEDULE
       ===================================================== */

    toggleSchedule: protectedProcedure
      .input(
        z.object({
          scheduleId: z.number(),

          active: z.boolean(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const devices = await db.getDevicesForUser(
          ctx.user.id,
          ctx.user.email ?? undefined,
        );

        let found:
          | Awaited<ReturnType<typeof db.getDeviceSchedules>>[number]
          | undefined;

        for (const device of devices) {
          const schedules = await db.getDeviceSchedules(device.id);

          found = schedules.find((s) => s.id === input.scheduleId);

          if (found) {
            break;
          }
        }

        if (!found) {
          throw new TRPCError({
            code: "NOT_FOUND",

            message: "Agendamento não encontrado.",
          });
        }

        const access = await requireDevice(ctx.user, found.deviceId);

        if (!access.canManage) {
          throw new TRPCError({
            code: "FORBIDDEN",
          });
        }

        await db.updateSchedule(found.id, {
          active: input.active,
        });

        const rows = await db.getDeviceSchedules(found.deviceId);

        await firebasePatch(firebaseDevicePath(access.device.id), {
          schedules: Object.fromEntries(
            rows.map((s) => [
              String(s.id),
              {
                hour: s.hour,

                minute: s.minute,

                quantity: s.quantity,

                active: s.active,
              },
            ]),
          ),
        });

        return {
          success: true,
        };
      }),

    /* =====================================================
       DELETE SCHEDULE
       ===================================================== */

    deleteSchedule: protectedProcedure
      .input(
        z.object({
          scheduleId: z.number(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const devices = await db.getDevicesForUser(
          ctx.user.id,
          ctx.user.email ?? undefined,
        );

        let found:
          | Awaited<ReturnType<typeof db.getDeviceSchedules>>[number]
          | undefined;

        for (const device of devices) {
          const schedules = await db.getDeviceSchedules(device.id);

          found = schedules.find((s) => s.id === input.scheduleId);

          if (found) {
            break;
          }
        }

        if (!found) {
          throw new TRPCError({
            code: "NOT_FOUND",

            message: "Agendamento não encontrado.",
          });
        }

        const access = await requireDevice(ctx.user, found.deviceId);

        if (!access.canManage) {
          throw new TRPCError({
            code: "FORBIDDEN",
          });
        }

        await db.deleteSchedule(found.id);

        const rows = await db.getDeviceSchedules(found.deviceId);

        const firebaseSchedules =
          rows.length > 0
            ? Object.fromEntries(
                rows.map((s) => [
                  String(s.id),
                  {
                    hour: s.hour,

                    minute: s.minute,

                    quantity: s.quantity,

                    active: s.active,
                  },
                ]),
              )
            : null;

        await firebasePatch(firebaseDevicePath(access.device.id), {
          schedules: firebaseSchedules,
        });

        return {
          success: true,
        };
      }),

    /* =====================================================
       ADD COLLABORATOR
       ===================================================== */

    addCollaborator: protectedProcedure
      .input(
        z.object({
          deviceId: z.number(),

          email: z.string().email(),

          role: z
            .enum(["administrator", "collaborator"])
            .default("collaborator"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const access = await requireDevice(ctx.user, input.deviceId);

        if (access.device.type !== "feeder") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Agendamentos só podem ser criados para o comedouro.",
          });
        }

        if (!access.canManage) {
          throw new TRPCError({
            code: "FORBIDDEN",
          });
        }

        const collaborator = await db.createCollaborator({
          deviceId: input.deviceId,

          email: input.email.toLowerCase(),

          role: input.role,
        });

        return {
          success: true,
          id: collaborator.id,
        };
      }),

    /* =====================================================
       REMOVE COLLABORATOR
       ===================================================== */

    removeCollaborator: protectedProcedure
      .input(
        z.object({
          collaboratorId: z.number(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const devices = await db.getDevicesForUser(
          ctx.user.id,
          ctx.user.email ?? undefined,
        );

        let found:
          | Awaited<ReturnType<typeof db.getDeviceCollaborators>>[number]
          | undefined;

        for (const device of devices) {
          const collaborators = await db.getDeviceCollaborators(device.id);

          found = collaborators.find((c) => c.id === input.collaboratorId);

          if (found) {
            break;
          }
        }

        if (!found) {
          throw new TRPCError({
            code: "NOT_FOUND",

            message: "Colaborador não encontrado.",
          });
        }

        const access = await requireDevice(ctx.user, found.deviceId);

        if (!access.canManage) {
          throw new TRPCError({
            code: "FORBIDDEN",
          });
        }

        await db.deleteCollaborator(found.id);

        return {
          success: true,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
