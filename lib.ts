/** Pure helpers, kept free of the Paseo SDK so they can run under `node --test`. */

export const WAKE_LABEL = "parent-wake";
export const RESPONSE_LIMIT = 4000;

type Labels = Readonly<Record<string, string>> | undefined;
type TimelineItem = { type: string; text?: string };

/** Opt-in: the parent or the child carries `parent-wake` with a value other than off/false/0. */
export function wantsWake(parentLabels: Labels, childLabels: Labels): boolean {
  const on = (value: string | undefined) =>
    value !== undefined && !["", "off", "false", "0"].includes(value.trim().toLowerCase());
  return on(parentLabels?.[WAKE_LABEL]) || on(childLabels?.[WAKE_LABEL]);
}

/** Claude streams one assistant_message item per chunk: join the last contiguous run. */
export function lastAssistantText(timeline: readonly TimelineItem[]): string {
  const chunks: string[] = [];
  for (let i = timeline.length - 1; i >= 0; i--) {
    const item = timeline[i];
    if (item.type === "assistant_message") chunks.unshift(item.text ?? "");
    else if (chunks.length) break;
  }
  return chunks.join("").trim();
}

export function responseBlock(text: string): string {
  if (!text) return "";
  const body =
    text.length > RESPONSE_LIMIT
      ? `${text.slice(0, RESPONSE_LIMIT)}\n[truncated ${text.length - RESPONSE_LIMIT} chars; use get_agent_activity for the full message]`
      : text;
  return `\n\n<agent-response>\n${body}\n</agent-response>`;
}

export function permissionBody(agentId: string, title: string, request: { id: string }): string {
  return [
    `Agent ${agentId} (${title}) needs permission.`,
    "Respond with `respond_to_permission` using the `agentId` and `requestId` below.",
    `<permission-request>\n${JSON.stringify({ agentId, requestId: request.id, request }, null, 2)}\n</permission-request>`,
  ].join("\n\n");
}

export function turnBody(agentId: string, title: string, error: string | null, lastText: string): string {
  const head = error ? `Agent ${agentId} (${title}) errored: ${error}` : `Agent ${agentId} (${title}) finished.`;
  return head + responseBlock(lastText);
}

export function systemMessage(body: string): string {
  return `<paseo-system>\n${body}\n</paseo-system>`;
}
