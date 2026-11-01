# gerunds

A mod for Claude Code that lets the model name the stretch of work it is in. The word is a gerund or a short phrase of the model's own choosing ("Weaving tehtar", "Racing the mod"), not a pick from a fixed list. matrix-spinner reads that word and draws it. Without matrix-spinner, Claude Code's own spinner keeps drawing, and this plugin still answers its tool and `/gerunds`.

The plugin name is `gerunds`. The tool is `mcp__gerunds__status`. The slash command is `/gerunds`.

## What it does

- `mcp__gerunds__status` takes a short text and sets the verb for the rest of the turn. Empty text leaves the verb unchanged. The text is capped at 48 characters. The tool's description tells the model it may call whenever a fresh word fits, not only after a long think. Nothing in the system prompt asks for the call.
- After one stretch of thinking that reaches `longThinkSeconds`, the next tool result carries a note asking the model to call `mcp__gerunds__status`. The plugin answers only its own tool, and never answers or replaces any other tool.
- Each call leaves a row in the transcript, shortened to `updated verb: <the verb>`. ctrl+o shows the whole call.
- `/gerunds` lists every verb set this session, oldest first, each with the time it was set, up to the last 500. The list is in session state only, and it is gone when the session ends.
- A verb lasts for the turn. The next turn starts again from the engine's own verb. The plugin reads and writes none of Claude Code's verb settings.

The current verb is session state under the key `verb`. matrix-spinner reads that key. This plugin does not rewrite the spinner's props.

## The one setting

`longThinkSeconds`, in the `/config` menu, is how long one stretch of thinking must last before the model is asked to set a verb. The default is 10 seconds. `0` turns that off.

## With the spinner

matrix-spinner is the companion that draws the word. It is not required. Installed together, the spinner shows the verb this plugin set, and a new verb restarts the scramble and the gleam. Installed alone, the engine's spinner is untouched and the transcript rows, the note, and `/gerunds` still work.

## Privacy

It sends nothing and makes no network requests. Session state holds the current verb, cleared when the turn ends, and the list behind `/gerunds`, kept for the session. See [PRIVACY.md](PRIVACY.md).

## Licence

MIT. See `LICENSE`.
