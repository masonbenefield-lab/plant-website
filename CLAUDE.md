@AGENTS.md

# Project Log Rule

Before any context compaction occurs, append a summary of all changes made in the current session to `NOTES.md` in the project root. Each entry must include:
- Date (use current date)
- A bullet list of every feature added, bug fixed, or file changed
- Any SQL migrations the user needs to run
- Any environment variables added or changed

Never overwrite NOTES.md — always append to it.
