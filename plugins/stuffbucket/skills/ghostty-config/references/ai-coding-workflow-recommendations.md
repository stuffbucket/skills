# AI Coding Workflow Recommendations

Opinionated Ghostty config for Claude Code and AI agent workflows. Always verify fonts and themes exist on the target machine via `ghostty +list-fonts` and `ghostty +list-themes` before applying.

## Philosophy

- Learn 5 keybinds, use command palette (`Cmd+Shift+P`) for everything else
- Don't remap unless the default is physically uncomfortable
- Optimize for splits — that's where multi-agent work lives
- Big scrollback — Claude output is long
- Auto-copy — reduce friction on every paste

## The 5 Essential Keybinds

| What | Keybind | Notes |
| ---- | ------- | ----- |
| Split right | `Cmd+D` | Default — open new Claude pane |
| Move between splits | `Ctrl+Arrow` | **Remap** — directional, comfortable 2-key combo |
| Close pane | `Cmd+W` | Default |
| Zoom split | `Cmd+Shift+Enter` | Default — toggle full-screen on one pane |
| Command palette | `Cmd+Shift+P` | Default — find any action you can't remember |

Also handy (already default, no config needed):

- `Cmd+Shift+D` — split down
- `Cmd+[` / `Cmd+]` — sequential split nav (alternative to directional)
- `Cmd+1-9` — jump to tab by number
- `Cmd+T` — new tab

## Remap: Directional Split Navigation

Default `Cmd+Alt+Arrow` is uncomfortable on laptop keyboards. Remap to `Ctrl+Arrow` (unbound by default, all four directions free):

```ini
keybind = ctrl+arrow_up=goto_split:up
keybind = ctrl+arrow_down=goto_split:down
keybind = ctrl+arrow_left=goto_split:left
keybind = ctrl+arrow_right=goto_split:right
```

## Optional Remap: Equalize Splits

Default `Cmd+Ctrl+=` is uncomfortable. Remap to `Cmd+Shift+=`:

```ini
keybind = super+shift+=equalize_splits
```

Or skip manual resize entirely — just use equalize after splitting.

## Font

Pick from what's installed (`ghostty +list-fonts`). Preference order:

1. Nerd Font variant (icon support for starship, powerlevel10k, etc.)
2. Any monospace font
3. System default (leave unset)

```ini
font-size = 14
font-thicken = true
```

`font-thicken = true` improves readability on Retina/HiDPI displays.

## Theme

Pick from `ghostty +list-themes`. Prefer high-contrast dark themes. Good defaults if available:

- `catppuccin-mocha` — well-balanced pastel dark
- `Tokyo Night` — minimal, easy on eyes
- `Dracula` — classic dark, good contrast
- `GruvboxDarkHard` — warm retro, strong contrast

Don't hardcode — always verify with `+list-themes` first.

## Performance & Session

```ini
scrollback-limit = 10000
window-save-state = always
copy-on-select = clipboard
```

- `scrollback-limit = 10000` — Claude output can be very long
- `window-save-state = always` — restore splits/tabs after restart
- `copy-on-select = clipboard` — selecting text copies automatically

## macOS Settings

```ini
macos-option-as-alt = true
```

Needed for shell shortcuts like `Alt+B`/`Alt+F` (word nav).

## Notifications

Ghostty supports OSC 9/777 notifications by default (`desktop-notifications = true`). Claude Code hooks can emit these:

```bash
printf '\e]9;Claude session complete\a'
```

No Ghostty config change needed.

## Platform Notes

### Linux

If `super` (Cmd equivalent) doesn't work reliably, remap essentials to `ctrl`:

```ini
keybind = ctrl+d=new_split:right
keybind = ctrl+shift+d=new_split:down
keybind = ctrl+bracketleft=goto_split:previous
keybind = ctrl+bracketright=goto_split:next
keybind = ctrl+w=close_surface
```

## Minimal Starter Config (macOS)

Generate after discovering fonts/themes. Example assuming FiraCode Nerd Font and catppuccin-mocha are available:

```ini
# Font
font-family = FiraCode Nerd Font Mono
font-size = 14
font-thicken = true

# Theme
theme = catppuccin-mocha

# Session
scrollback-limit = 10000
window-save-state = always
copy-on-select = clipboard

# macOS
macos-option-as-alt = true

# Directional split nav (Ctrl+Arrow — comfortable on laptop keyboards)
keybind = ctrl+arrow_up=goto_split:up
keybind = ctrl+arrow_down=goto_split:down
keybind = ctrl+arrow_left=goto_split:left
keybind = ctrl+arrow_right=goto_split:right

# Equalize splits (replace uncomfortable Cmd+Ctrl+=)
keybind = super+shift+=equalize_splits
```
