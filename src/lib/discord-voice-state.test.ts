import { describe, expect, it } from "vitest";
import {
  calculateReconnectDelay,
  canRecoverVoiceSession,
  VOICE_SESSION_STATES,
} from "../../workers/discord-voice/voice-state";

describe("Discord voice session policy", () => {
  it("defines observable lifecycle states", () => {
    expect(VOICE_SESSION_STATES).toEqual(expect.arrayContaining([
      "CONNECTING", "LISTENING", "SPEAKING", "RECONNECTING", "PROCESSING", "ERROR",
    ]));
  });

  it("uses capped exponential backoff with jitter", () => {
    expect(calculateReconnectDelay({ attempt: 1, baseDelayMs: 1_000, maxDelayMs: 8_000, random: () => 0 })).toBe(1_000);
    expect(calculateReconnectDelay({ attempt: 4, baseDelayMs: 1_000, maxDelayMs: 8_000, random: () => 0 })).toBe(8_000);
    expect(calculateReconnectDelay({ attempt: 9, baseDelayMs: 1_000, maxDelayMs: 8_000, random: () => 0.5 })).toBe(9_000);
  });

  it("does not reconnect sessions that are stopping or processing", () => {
    expect(canRecoverVoiceSession("LISTENING")).toBe(true);
    expect(canRecoverVoiceSession("STOPPING")).toBe(false);
    expect(canRecoverVoiceSession("PROCESSING")).toBe(false);
  });
});
