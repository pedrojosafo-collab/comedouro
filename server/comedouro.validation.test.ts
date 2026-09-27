import { describe, expect, it } from "vitest";
import { deviceInput, scheduleInput } from "./routers";

describe("COMEDOURO input validation", () => {
  it("accepts a valid device identifier", () => {
    const parsed = deviceInput.safeParse({ deviceId: "COMEDOURO-001", name: "Comedouro da sala" });
    expect(parsed.success).toBe(true);
  });

  it("rejects unsafe or incomplete device identifiers", () => {
    expect(deviceInput.safeParse({ deviceId: "a", name: "X" }).success).toBe(false);
    expect(deviceInput.safeParse({ deviceId: "COMEDOURO 001", name: "Sala" }).success).toBe(false);
  });

  it("accepts a schedule in the valid clock range", () => {
    const parsed = scheduleInput.safeParse({ deviceId: 1, hour: 6, minute: 30, quantity: 2 });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.quantity).toBe(2);
  });

  it("rejects invalid hours, minutes and quantities", () => {
    expect(scheduleInput.safeParse({ deviceId: 1, hour: 24, minute: 0, quantity: 1 }).success).toBe(false);
    expect(scheduleInput.safeParse({ deviceId: 1, hour: 10, minute: 60, quantity: 1 }).success).toBe(false);
    expect(scheduleInput.safeParse({ deviceId: 1, hour: 10, minute: 0, quantity: 11 }).success).toBe(false);
  });
});
