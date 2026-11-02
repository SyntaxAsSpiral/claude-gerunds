# gerunds

A mod for Claude Code that lets the model name the work it is in. The word is a gerund or a short phrase of the model's own choosing ("Weaving tehtar", "Racing the mod"), not a pick from a fixed list, and it replaces the word beside the working spinner.

## Install

At the prompt of a terminal session:

```
/plugin install gerunds --marketplace SyntaxAsSpiral/claude-gerunds
```

From a shell:

```
claude plugin install gerunds --marketplace SyntaxAsSpiral/claude-gerunds
```

Answer `y` to add the marketplace, then choose a scope.

## What it does

- The model sets the word with `mcp__gerunds__status` (up to 48 characters). It lasts for the turn, then the engine's own word returns.
- After one long stretch of thinking, the model is asked once to set a fresh word. `longThinkSeconds` in `/config` sets how long (default 10 seconds, `0` turns it off).
- Each call leaves a row in the transcript, `updated verb: <the verb>`. ctrl+o shows the whole call.
- `/gerunds` lists the verbs set this session, oldest first, with their times (the last 500; gone when the session ends).

If another mod draws the spinner itself, gerunds has to run ahead of it (the `prependPlugins` setting) for the word to reach it.

## Privacy

It sends nothing and makes no network requests. See [PRIVACY.md](PRIVACY.md).

## Licence

MIT. See `LICENSE`.
