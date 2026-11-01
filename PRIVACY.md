# Privacy

gerunds does not send any data about you.

- It reads the model's streamed output in memory, only to time thinking. After a stretch that reaches `longThinkSeconds`, that timing arms one note on the next tool result. The timing stays in memory and is reset when the next turn starts. It does not count tokens and it does not keep the text.
- Session state holds the current verb. It is empty at the start of a turn, it becomes the text passed to `mcp__gerunds__status` when that text is non-empty, and it is cleared when the turn ends. It is not written to a file.
- Session state also holds the list of verbs set this session, each with the time it was set, up to the last 500, so `/gerunds` can print them. It is in memory only, is never written to a file, and ends with the session.
- It makes no network requests.
- It reads and writes no files, and starts no processes.
- It uses its own `longThinkSeconds` option, passed into `register`. It calls no `$.config.list()`, writes no setting, and reads no environment variables.
- It has no analytics or telemetry.

## What code runs

The code that runs is `hooks/register.tsx`, named in `hooks/hooks.json`. Its engine calls are `$.clock.now`, `$.tool.register`, `$.command.register`, `$.state.get`, `$.state.set`, `$.ui.invalidate`, and `$.ui.resolve`. `$.command.register` adds one slash command, `/gerunds`, answered by a `command.run` hook that only reads the verb list. `$.tool.register` adds one tool, `status`, exposed as `mcp__gerunds__status`. The verb and the list are held with `$.state`. It hooks `tool.call` for every tool, only to answer its own tool and, once after a long think, to add the note to one other tool's result. For any other tool it reads the tool's name and, to keep them intact, the result's `deny` and `context` fields. It reads nothing from the tool's input or output, and the call passes through unchanged. It also hooks `ui.render` on tool rows and results, only to draw its own tool's row in short form. For any other tool it passes the row through untouched, and it reads only that call's `text`. It declares no MCP servers, runs no shell commands, and runs no other code.

A non-empty text passed to the tool sets the verb. The tool's description names `mcp__gerunds__status` and says the model may call it whenever a fresh word fits. After a long stretch of thinking, the next tool result gets one note asking the model to call it. The note is in `hooks/register.tsx` and is described in the README.
