#!/bin/sh
# Custom AppRun entrypoint for an AppImage.
# Tauri produces a working AppRun by default — only drop in this custom
# one when you need to tweak environment before the app launches (e.g.
# force a particular GTK theme, work around a WebKitGTK env var issue).
#
# Place at the root of the AppDir before appimagetool runs.

set -e

HERE="$(dirname "$(readlink -f "${0}")")"

# Make bundled libs win over system libs.
export LD_LIBRARY_PATH="${HERE}/usr/lib:${LD_LIBRARY_PATH}"

# Point GIO/GLib at the bundled schemas (only needed if you ship custom schemas).
export GSETTINGS_SCHEMA_DIR="${HERE}/usr/share/glib-2.0/schemas:${GSETTINGS_SCHEMA_DIR}"

# Work around WebKitGTK sandbox failures inside AppImage on some hosts.
export WEBKIT_DISABLE_COMPOSITING_MODE=1

# If your app crashes inside the WebKit DMABUF renderer on Wayland, uncomment:
# export WEBKIT_DISABLE_DMABUF_RENDERER=1

# Pick up XDG dirs the host advertises.
export XDG_DATA_DIRS="${HERE}/usr/share:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"

exec "${HERE}/usr/bin/myapp" "$@"
