# parent-wake

Wakes an orchestrating parent agent in [Paseo](https://paseo.sh) on **every** question and **every** finished turn of its child agents, not only the first one.

## Why

When an agent spawns another with `create_agent` or `send_agent_prompt`, Paseo's `notifyOnFinish` subscribes the parent once per prompt: the parent hears about the child's permission requests only until the child's first finished (or errored) turn, then the subscription ends. A child that ends a turn early (for example, after delegating to its own subagent) and later asks a question wakes nobody. The parent only finds out when someone else prompts it and it happens to call `list_pending_permissions`.

This plugin listens to the daemon's lifecycle hooks and keeps waking the parent for as long as the child carries the `paseo.parent-agent-id` label and the parent is not archived.

## Install

```bash
paseo plugin add EPISTEX0/paseo-parent-wake
```

Plugins must be enabled on the daemon (**Settings → Plugins → Enable plugins**). Requires Paseo 0.8 or later. Server-only: no UI, no network, no filesystem access.

From a local checkout:

```bash
git clone https://github.com/EPISTEX0/paseo-parent-wake
cd paseo-parent-wake && npm install && npm run typecheck && npm test
paseo plugin install "$PWD"
```

## Setup

The plugin does nothing until an agent opts in with the label `parent-wake` (any value except `off`, `false`, `0`), on either side:

- **On the parent**, to cover every child it spawns:
  `update_agent(agentId: <own id>, labels: {"parent-wake": "always"})`. An agent's own id is in `PASEO_AGENT_ID`.
- **On a child**, at spawn time:
  `create_agent(..., labels: {"parent-wake": "always"}, notifyOnFinish: false)`.

Pass `notifyOnFinish: false` on `create_agent` and `send_agent_prompt` once the plugin is active, otherwise the first notification arrives twice (once from Paseo, once from the plugin). Parents without the label keep Paseo's built-in behavior unchanged.

## How it works

- Hooks `agent.permission_requested` and `agent.turn_ended` (`completed` and `failed`; `canceled` is skipped).
- Sends the parent a `<paseo-system>` message shaped like Paseo's own notification, with a readable first line:

  ```
  <paseo-system>
  Lead · run-live-character asks: "ping?" — yes / no

  Answer with `respond_to_permission` · agentId: <id> · requestId: <id>

  <permission-request>
  { ...the request exactly as Paseo reported it... }
  </permission-request>
  </paseo-system>
  ```

  Finished turns read `<title> finished. · agentId: <id>` followed by `<agent-response>` with the last assistant message (capped at 4000 characters); failed turns read `errored: <message>`. Delivered with `activeTurnBehavior: "steer"` so a running parent is not interrupted.
- If the parent itself has a permission pending (for example its own `AskUserQuestion`), the message is held and delivered when that permission is resolved or the parent's turn ends. Sending immediately would clear the parent's pending question.
- Each permission request id is delivered once.

## Limitations

- Events raised while the daemon or the plugin is restarting are not replayed.
- Held messages live in memory; a plugin restart drops them.
- The message format mirrors Paseo 0.8's wording. If Paseo changes it, the parent still gets the ids it needs, only the prose differs.
- If Paseo ever adds a persistent notify option, prefer it and remove this plugin.
