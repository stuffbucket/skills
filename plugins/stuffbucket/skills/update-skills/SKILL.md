---
name: update-skills
description: Check for stuffbucket MCP server updates and apply them. Use when the user asks to update skills, check for new versions, or upgrade the stuffbucket MCP server.
allowed-tools: Bash
metadata:
  author: stuffbucket
  version: 2.0.0
---

# Update Skills

Check for and apply updates to the Stuffbucket Skills installation. This is the
**apply** side of a notify-only flow: the MCP server (and the `check_updates`
tool) only *tell* the user an update exists — nothing upgrades until you run the
steps below.

## 1. Check for updates

```bash
node {{SKILL_DIR}}/scripts/version-check.js
```

Queries the **npm registry** for the latest published version and compares it to
the installed one. Works for every install type (npm, npx, git, plugin) and
needs no `.git`. If it prints "Up to date", stop here.

## 2. Detect how this package is installed

```bash
node {{SKILL_DIR}}/scripts/detect-install.js
```

Prints `<type> <install-root>`, where `<type>` is `npx`, `npm-global`, or `git`.
The correct upgrade command depends on it. The detection is best-effort — if the
type looks wrong for how the user installed it, pick the matching command below.

## 3. Apply the upgrade

Run the command for the detected install type:

- **npx** — the default `.mcp.json` launch (`npx -y -p @stuffbucket/skills …`).
  npx caches resolved packages, so a new session keeps using the cached copy.
  Clear the npx cache so the next launch re-resolves the latest release:

  ```bash
  rm -rf "$(npm config get cache)/_npx"
  ```

- **npm-global** — installed with `npm install -g @stuffbucket/skills`:

  ```bash
  npm install -g @stuffbucket/skills@latest
  ```

- **git** — a clone or Claude Code marketplace plugin. Use the `<install-root>`
  from step 2 and the latest version from step 1:

  ```bash
  git -C <install-root> fetch --tags origin
  git -C <install-root> checkout v<latest>
  ```

  (If installed as a Claude Code plugin, the marketplace can also update it —
  remove and re-add the plugin.)

## 4. Restart to take effect

The MCP server process is already running the old code. Start a **new agent
session** (or restart your MCP client) so it launches the upgraded version. MCP
client configs never change — they point to the same local path/command.

## 5. Verify

Re-run step 1 in the new session. It should report "Up to date".

## Notes

- **Notify-only by design.** Nothing here auto-installs on its own; the user
  invokes this skill and the agent runs the commands. This mirrors the
  `stuffbucket/maximal` update model.
- The changelog for what's new is at
  <https://github.com/stuffbucket/skills/releases>.
