import { test } from "node:test";
import assert from "node:assert/strict";
import { lastAssistantText, permissionBody, responseBlock, turnBody, wantsWake } from "./lib.ts";

test("wantsWake: opt-in on parent or child, off values ignored", () => {
  assert.equal(wantsWake(undefined, undefined), false);
  assert.equal(wantsWake({ "parent-wake": "always" }, undefined), true);
  assert.equal(wantsWake(undefined, { "parent-wake": "always" }), true);
  assert.equal(wantsWake({ "parent-wake": "off" }, { "parent-wake": "false" }), false);
});

test("lastAssistantText joins streamed chunks after the last non-assistant item", () => {
  const timeline = [
    { type: "assistant_message", text: "old" },
    { type: "tool_call" },
    { type: "assistant_message", text: "p" },
    { type: "assistant_message", text: "ong" },
  ];
  assert.equal(lastAssistantText(timeline), "pong");
  assert.equal(lastAssistantText([{ type: "tool_call" }]), "");
});

test("responseBlock truncates long text", () => {
  assert.equal(responseBlock(""), "");
  assert.match(responseBlock("x".repeat(4500)), /\[truncated 500 chars;/);
});

test("bodies follow Paseo's own notification wording", () => {
  const p = permissionBody("a1", "Lead", { id: "r1" });
  assert.match(p, /^Agent a1 \(Lead\) needs permission\./);
  assert.match(p, /"requestId": "r1"/);
  assert.equal(turnBody("a1", "Lead", null, "done"), "Agent a1 (Lead) finished.\n\n<agent-response>\ndone\n</agent-response>");
  assert.match(turnBody("a1", "Lead", "boom", ""), /errored: boom$/);
});
