import type { PluginHookAgent, PluginHookContext, PluginServerContext } from "@getpaseo/plugin/server";
import { lastAssistantText, permissionBody, systemMessage, turnBody, wantsWake } from "./lib.ts";

type Paseo = PluginHookContext["paseo"];

export default function contribute(server: PluginServerContext) {
  const notifiedRequests = new Set<string>();
  // Messages held while the parent has its own permission pending: sending would clear it.
  const held = new Map<string, string[]>();

  async function deliver(paseo: Paseo, parentId: string, body: string) {
    const parent = paseo.agents.ref(parentId);
    // The daemon accepts activeTurnBehavior even though the SDK type omits it; default would interrupt.
    const options = { activeTurnBehavior: "steer" } as Parameters<typeof parent.send>[1];
    await parent.send(systemMessage(body), options);
    console.log(`[parent-wake] → ${parentId}: ${body.split("\n")[0]}`);
  }

  async function wake(paseo: Paseo, child: PluginHookAgent, body: string) {
    const parentId = child.parentAgentId;
    if (!parentId) return;
    const parent = paseo.agents.ref(parentId);
    const snapshot = (await parent.refresh())?.agent ?? parent.current();
    if (!snapshot || snapshot.archivedAt) return;
    const childLabels = (await paseo.agents.ref(child.id).refresh())?.agent?.labels;
    if (!wantsWake(snapshot.labels, childLabels)) return;
    if (snapshot.pendingPermissions.length > 0) {
      held.set(parentId, [...(held.get(parentId) ?? []), body]);
      console.log(`[parent-wake] held for ${parentId} (parent has a pending permission): ${body.split("\n")[0]}`);
      return;
    }
    await deliver(paseo, parentId, body);
  }

  async function flush(paseo: Paseo, parentId: string) {
    const bodies = held.get(parentId);
    if (!bodies?.length) return;
    held.delete(parentId);
    for (const body of bodies) await deliver(paseo, parentId, body);
  }

  const off = [
    server.on("agent.permission_requested", async ({ agent, request }, { paseo }) => {
      if (notifiedRequests.has(request.id)) return;
      notifiedRequests.add(request.id);
      await wake(paseo, agent, permissionBody(agent.id, agent.title ?? agent.id, request));
    }),
    server.on("agent.permission_resolved", async ({ agent, requestId }, { paseo }) => {
      notifiedRequests.delete(requestId);
      await flush(paseo, agent.id);
    }),
    server.on("agent.turn_ended", async ({ agent, outcome, timeline }, { paseo }) => {
      await flush(paseo, agent.id);
      if (outcome.kind === "canceled") return;
      const error = outcome.kind === "failed" ? outcome.error.message : null;
      await wake(paseo, agent, turnBody(agent.id, agent.title ?? agent.id, error, lastAssistantText(timeline)));
    }),
  ];

  return () => {
    for (const remove of off) remove();
  };
}
