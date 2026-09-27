import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const devices = mysqlTable("devices", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: varchar("deviceId", { length: 80 }).notNull().unique(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  deviceKey: varchar("deviceKey", { length: 120 }).notNull(),
  status: mysqlEnum("status", ["online", "offline"]).default("offline").notNull(),
  wifi: varchar("wifi", { length: 120 }),
  lastSeen: timestamp("lastSeen"),
  lastFeeding: timestamp("lastFeeding"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const schedules = mysqlTable("schedules", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  hour: int("hour").notNull(),
  minute: int("minute").notNull(),
  quantity: int("quantity").default(1).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const feedings = mysqlTable("feedings", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  type: mysqlEnum("type", ["manual", "automatic"]).notNull(),
  quantity: int("quantity").default(1).notNull(),
  scheduledTime: varchar("scheduledTime", { length: 5 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const collaborators = mysqlTable("collaborators", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["administrator", "collaborator"]).default("collaborator").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type Feeding = typeof feedings.$inferSelect;
export type Collaborator = typeof collaborators.$inferSelect;
