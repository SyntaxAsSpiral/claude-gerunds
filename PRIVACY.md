# Privacy

gerunds does not send any data about you.

- It reads the model's streamed output in memory, only to time thinking. It does not count tokens or keep the text. The timing is reset when the next turn starts.
- Session state holds the current verb, cleared when the turn ends, and the list of verbs set this session with their times, up to the last 500. Both are in memory only and end with the session.
- It makes no network requests, reads and writes no files, starts no processes, and reads no environment variables.
- It reads only its own `longThinkSeconds` option and writes no setting.
- It has no analytics or telemetry.

## What code runs

`hooks/register.tsx`, named in `hooks/hooks.json`. Its engine calls are `$.clock.now`, `$.tool.register`, `$.command.register`, `$.state.get`, `$.state.set`, `$.ui.invalidate` and `$.ui.resolve`.

- **Tool:** it adds one tool, `mcp__gerunds__status`, and answers only that tool.
- **Command:** it adds `/gerunds`, which reads only the verb list.
- **`tool.call` hook:** for other tools it reads the tool's name and the result's `deny` and `context` fields, and passes the call through. Once after a long think it adds a note to one result asking the model to set a verb.
- **Render hooks:** on the Spinner it swaps in the current verb, if there is one. On `/gerunds` output it drops the `gerunds:` label. It draws its own tool's row in short form. Everything else passes through untouched.

It declares no MCP servers and runs no shell commands or other code.
