# Ghostty Keybind Actions Reference

This file is for the agent to consult when configuring keybinds. Users should NOT memorize this — they learn 5 essential keybinds and use `Cmd+Shift+P` (command palette) for everything else.

## Essential Keybinds (what users actually need to know)

1. `Cmd+D` — split right
2. `Cmd+[` / `Cmd+]` — move between splits
3. `Cmd+W` — close pane/tab/window
4. `Cmd+Shift+Enter` — zoom/unzoom current split
5. `Cmd+Shift+P` — command palette (search for any action)

Everything else is discoverable via the command palette.

## Keybind Syntax (for agent use when writing config)

Format: `keybind = <trigger>=<action>` or `keybind = <trigger>=<action>:<argument>`

Modifiers: `super` (Cmd on macOS), `ctrl`, `alt`, `shift`. Combine with `+`.

Key sequences: `ctrl+a>n` (press ctrl+a, then n)

Prefixes: `global:`, `unconsumed:`, `all:` (before trigger)

Chained actions (1.3.0+):

```ini
keybind = ctrl+a=new_window
keybind = chain=goto_split:left
```

Unbind: `keybind = <trigger>=unbind`

## Complete Action List

### Splits

- `new_split` — Args: `right`, `down`, `left`, `up`, `auto`
- `goto_split` — Args: `previous`, `next`, `top`, `bottom`, `left`, `right`, `up`, `down`
- `toggle_split_zoom` — Zoom/unzoom split to fill window
- `resize_split` — Args: `<direction>,<pixels>` (e.g., `up,10`)
- `equalize_splits` — Make all splits equal

### Tabs

- `new_tab`, `previous_tab`, `next_tab`, `last_tab`
- `goto_tab` — Arg: 1-based index
- `move_tab` — Arg: relative offset
- `close_tab` — Args: `this`, `other`, `right`
- `toggle_tab_overview` — Linux only

### Windows

- `new_window`, `close_window`, `close_all_windows`, `close_surface`
- `goto_window` — Args: `previous`, `next`
- `toggle_fullscreen`, `toggle_maximize`, `toggle_window_decorations`
- `toggle_window_float_on_top`, `toggle_background_opacity`
- `reset_window_size` — macOS only

### Clipboard

- `copy_to_clipboard` — Args: `standard`, `mixed`
- `paste_from_clipboard`, `paste_from_selection`
- `copy_url_to_clipboard`, `copy_title_to_clipboard`

### Font

- `increase_font_size`, `decrease_font_size`, `reset_font_size`
- `set_font_size` — Arg: size in points

### Scroll & Navigation

- `scroll_to_top`, `scroll_to_bottom`, `scroll_to_selection`
- `scroll_page_up`, `scroll_page_down`
- `scroll_page_fractional` — Arg: fraction (e.g., `0.5`)
- `scroll_page_lines` — Arg: line count
- `jump_to_prompt` — Arg: `-1` (prev), `1` (next)

### Search

- `start_search`, `end_search`
- `search_selection` — Search for selected text
- `navigate_search` — Args: `next`, `previous`

### Screen & Selection

- `clear_screen`, `select_all`
- `adjust_selection` — Args: `left`, `right`, `up`, `down`, `home`, `end`, `page_up`, `page_down`

### Export

- `write_scrollback_file` — Args: `open`, `paste`, `copy` (optionally `,plain`)
- `write_screen_file`, `write_selection_file` — Same args

### Config

- `open_config`, `reload_config`

### UI

- `toggle_command_palette`, `toggle_quick_terminal`, `toggle_visibility`
- `toggle_readonly`, `toggle_secure_input`, `toggle_mouse_reporting`

### Title

- `prompt_surface_title`, `prompt_tab_title`
- `set_surface_title`, `set_tab_title` — Arg: title string

### Key Tables (modal input, 1.3.0+)

- `activate_key_table`, `activate_key_table_once` — Arg: table name
- `deactivate_key_table`, `deactivate_all_key_tables`
- `end_key_sequence`

### Low-Level

- `ignore`, `unbind`, `reset`
- `csi`, `esc`, `text`, `cursor_key` — Send raw sequences

### Other

- `undo`, `redo`, `quit`
- `inspector`, `check_for_updates`
