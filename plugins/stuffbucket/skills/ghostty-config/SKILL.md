---
name: ghostty-config
description: "Configure and optimize Ghostty terminal for any machine. Use when setting up Ghostty from scratch, changing fonts/themes/keybinds, optimizing for AI coding workflows, validating config, provisioning Ghostty for a team, troubleshooting Ghostty rendering or keybind issues, handling Ghostty upgrades, or fixing SSH terminfo problems."
---

# Ghostty Config

## Gate: Verify Ghostty is installed

Run `ghostty +version` before anything else. If it fails:

- macOS: `brew install ghostty` or download from ghostty.org/download
- Linux: snap/deb/nix or build from source (ghostty.org/docs/install/build)
- Windows: community fork github.com/Thr45hx/ghostty-windows (unofficial)

Do NOT proceed until `ghostty +version` succeeds. Note the platform and version.

## Config file

Location: `~/.config/ghostty/config`

Create directory if absent: `mkdir -p ~/.config/ghostty`

Format: `key = value`, one per line, `#` comments, no sections or headers.

Ghostty auto-reloads most config changes. Some require restart (noted in docs).

## CLI tools — use as source of truth

Never guess option names, theme names, or font names. Always discover from the CLI:

- `ghostty +show-config` — current config with all defaults
- `ghostty +show-config --default --docs` — defaults with inline documentation
- `ghostty +validate-config` — validate config file (MANDATORY after every write)
- `ghostty +list-themes` — themes available on THIS machine
- `ghostty +list-fonts` — fonts installed on THIS machine
- `ghostty +list-keybinds` — current keybind mappings
- `ghostty +list-actions` — all available keybind actions
- `ghostty +list-colors` — current color palette

## Mandatory rules

1. After writing ANY config change → run `ghostty +validate-config`
2. Before recommending a theme → run `ghostty +list-themes` to confirm it exists
3. Before recommending a font → run `ghostty +list-fonts` to confirm it's installed
4. Never hardcode font or theme names without runtime verification

## Workflow: Provision new machine

1. `ghostty +version` — confirm installed, note platform
2. `mkdir -p ~/.config/ghostty`
3. `ghostty +list-fonts` — find best available font (prefer Nerd Font → monospace → system default)
4. `ghostty +list-themes` — pick high-contrast dark theme from what's available
5. Read `references/ai-coding-workflow-recommendations.md` for opinionated defaults
6. Write config adapted to this machine's fonts, themes, and platform
7. `ghostty +validate-config` — must pass with no errors

## Workflow: Change theme or font

1. `ghostty +list-themes` or `ghostty +list-fonts` — browse what's available
2. Update the relevant line in config
3. `ghostty +validate-config`

## Workflow: Troubleshooting

- **Config errors:** `ghostty +validate-config` — shows exact errors
- **Font not rendering:** `ghostty +list-fonts` — verify the font name matches exactly
- **Keybind not working:** `ghostty +list-keybinds` — check for conflicts or typos
- **Broken rendering over SSH:** Ghostty needs its terminfo on the remote.
  Use `ghostty +ssh-cache` or set `shell-integration-features = ssh-terminfo` in config,
  or manually copy terminfo: `infocmp -x | ssh user@host tic -x -`
- **Notifications not firing:** Check `desktop-notifications = true` in config (default). On macOS, check system notification permissions for Ghostty.

## Workflow: After Ghostty upgrade

1. `ghostty +version` — confirm new version
2. `ghostty +validate-config` — check if any options were deprecated or changed
3. `ghostty +show-config --default --docs` — review new options available
4. Update config if needed, re-validate

## When to read reference files

- `references/option-reference.txt` — full Ghostty config reference from `ghostty +show-config --default --docs`
  (4000+ lines — grep for specific keys, don't read the whole thing)
- `references/keybind-actions.md` — all keybind actions with arguments and syntax
- `references/ai-coding-workflow-recommendations.md` — opinionated defaults, keybind philosophy, starter config template
