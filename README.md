# finder-pane

A [Claude Code](https://claude.com/claude-code) mod for macOS. Every time Claude finishes a reply, the mod scans the reply text for local file and folder paths, keeps the ones that actually exist, and lists them in a **Files** pane beside the chat. Click a row, or focus the pane (`ctrl+x tab`) and press its digit, and the file is revealed in Finder (`open -R`); a folder is opened directly. Bundles such as `.app` and symbolic links are only revealed (`open -R`), so nothing is launched.

日本語の説明は [README.ja.md](README.ja.md) にあります。

## Why

Claude often ends a reply with "open `images/03_header.png` and check it". In a terminal that path is just text. This mod turns it into something you can click.

## Install

At the prompt of a terminal session:

```
/plugin install finder-pane --marketplace i-noma-ru/finder-pane
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session). From a shell: `claude plugin install finder-pane --marketplace i-noma-ru/finder-pane`. In the desktop app, click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `i-noma-ru/finder-pane`, then **Add plugin**.

## What it picks up

- Relative paths with at least one slash (`docs/dev_log.md`, `out/review/`), resolved against the session's working directory
- Absolute paths (`/Users/you/...`) and `~/...`
- Japanese punctuation (、。「」（）) and backticks count as word boundaries, so paths inside Japanese sentences are found

It skips URLs, globs containing `*`, bare file names without a slash, and anything that does not exist on disk. At most 9 rows per reply; a new reply replaces the list. Only the main conversation's replies are read, not subagent reports.

## Commands

- `/files` opens or closes the pane. The pane also opens by itself when a reply contains at least one existing path and the pane is closed.

## Requirements

- macOS (uses the `open` command). Not supported on Windows or Linux.
- For the pane to open unasked, a terminal of 144 columns or more (110 if you opened it with `/files` before and have not closed it by hand since). Opening it with `/files` works at any width.
- When another mod's pane is open, an unasked pane may land in a tab behind it; a toast then says "ファイル N 件 — /files で表示" (N files, show with /files).

## Files

- `hooks/register.tsx`: hooks (`turn.complete`, `ui.render` for the pane, `/files`)
- `hooks/logic.ts`: pure functions that extract and resolve paths
- `types/index.d.ts`: the `$.state` contract
- `tests/finder-pane.test.tsx`: tests for `claude plugin test`

## Status

Version 0.1.0. Validated with `claude plugin validate`; the path extractor is unit-checked against a sample reply. Feedback and issues are welcome.

## License

MIT
