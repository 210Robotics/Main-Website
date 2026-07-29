const dmActionPattern = /^dm:(manual|gemini):(\d{15,22})$/;
const dmModalPattern = /^dm:manual-submit:(\d{15,22})$/;

export type DiscordDmAction =
  | { kind: "manual"; inboundMessageId: string }
  | { kind: "gemini"; inboundMessageId: string };

export function parseDiscordDmActionId(
  customId: string,
): DiscordDmAction | null {
  const match = dmActionPattern.exec(customId);
  if (!match) return null;
  return {
    kind: match[1] as DiscordDmAction["kind"],
    inboundMessageId: match[2],
  };
}

export function parseDiscordDmModalId(customId: string) {
  const match = dmModalPattern.exec(customId);
  return match ? { inboundMessageId: match[1] } : null;
}

export function extractDiscordDmModalReply(
  components:
    | Array<{
        components?: Array<{ custom_id?: string; value?: string }>;
      }>
    | undefined,
) {
  return (
    components
      ?.flatMap((row) => row.components || [])
      .find((component) => component.custom_id === "reply")?.value || ""
  )
    .trim()
    .slice(0, 1_800);
}
