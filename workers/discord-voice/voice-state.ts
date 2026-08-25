export const VOICE_SESSION_STATES = [
  "DISCONNECTED",
  "CONNECTING",
  "READY",
  "LISTENING",
  "PROCESSING",
  "SPEAKING",
  "RECONNECTING",
  "STOPPING",
  "ERROR",
] as const;

export type VoiceSessionState = (typeof VOICE_SESSION_STATES)[number];

export function calculateReconnectDelay(input: {
  attempt: number;
  baseDelayMs: number;
  maxDelayMs: number;
  random?: () => number;
}) {
  const exponential = Math.min(
    input.maxDelayMs,
    input.baseDelayMs * 2 ** Math.max(0, input.attempt - 1),
  );
  const jitter = Math.floor(
    (input.random || Math.random)() * Math.max(100, exponential * 0.25),
  );
  return exponential + jitter;
}

export function canRecoverVoiceSession(state: VoiceSessionState) {
  return !["DISCONNECTED", "STOPPING", "PROCESSING"].includes(state);
}
