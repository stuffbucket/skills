---
name: tauri-plugins-deep-link
description: Use when registering custom URL schemes or universal/app links for a Tauri v2 app — schema declaration in `tauri.conf.json` under `plugins.deep-link`, iOS Associated Domains, Android ``intent-filter`` entries, `onOpenUrl` + `getCurrent` in JS, runtime `register()` on Linux/Windows, pairing with `tauri-plugin-single-instance` so a second launch routes the URL to the existing window, and dev-time testing per OS.
---

# Tauri v2: Deep Link Plugin

Two related capabilities under one plugin:

- **Custom URL schemes** — `myapp://thing/42` opens your app. Works on every OS; no server required.
- **Universal / App Links** — `https://yourdomain.com/thing/42` opens your app instead of the
  browser. Requires a verified file on the domain. Mobile-only (iOS Associated Domains, Android App
  Links).

Use schemes for everything unless you specifically need https links (e.g. share-from-web-to-app
flows).

## Install

```sh
npm run tauri add deep-link
```

Manual: `tauri-plugin-deep-link = "2"`, `@tauri-apps/plugin-deep-link`,
`.plugin(tauri_plugin_deep_link::init())`.

## Configuration — `tauri.conf.json`

```json
{
  "plugins": {
    "deep-link": {
      "desktop": {
        "schemes": ["myapp"]
      },
      "mobile": [
        {
          "scheme": ["myapp"],
          "appLink": false
        },
        {
          "host": ["yourdomain.com"],
          "appLink": true
        }
      ]
    }
  }
}
```

The `mobile` array can mix custom schemes (`appLink: false`) and verified links (`appLink: true` +
`host`).

## Per-platform plumbing

| OS      | What the plugin handles                                                                  | What you still must do                                                      |
| ------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| macOS   | `CFBundleURLTypes` in `Info.plist` via `tauri.bundle.macOS.entitlements`-adjacent config | Bundle the app (system scheme registration happens at install)              |
| Windows | Registry keys on install                                                                 | Use NSIS/MSI bundle; portable exe won't register                            |
| Linux   | `.desktop` file + `xdg-mime` association                                                 | Install via deb/rpm/AppImage with `tauri build`; `cargo run` won't register |
| iOS     | URL types in `Info.plist`; Associated Domains entitlement for app links                  | Host `/.well-known/apple-app-site-association` on the verified domain       |
| Android | `<intent-filter>` in `AndroidManifest.xml`; `android:autoVerify` for App Links           | Host `/.well-known/assetlinks.json`                                         |

The plugin generates the per-OS manifest entries from `tauri.conf.json` — you usually don't need to
touch the platform-specific files unless you want to pre-empt Tauri's templating.

## JS API

```ts
import { onOpenUrl, getCurrent } from '@tauri-apps/plugin-deep-link';

// Cold launch — the URL the app was opened with, if any.
const initial = await getCurrent();   // string[] | null
if (initial?.length) handleUrl(initial[0]);

// Warm: subsequent triggers (second-instance, OS-side dispatch).
await onOpenUrl((urls) => {
  for (const url of urls) handleUrl(url);
});

function handleUrl(url: string) {
  const u = new URL(url);
  // myapp://thing/42 → u.protocol === 'myapp:', u.pathname === '//thing/42'
  // Normalize: u.host + u.pathname
  console.log(u.host, u.pathname, Object.fromEntries(u.searchParams));
}
```

`getCurrent()` is critical for **cold-launch** URLs — `onOpenUrl` only fires for events that arrive
after the listener registers, so without `getCurrent()` you'll miss the URL that opened the app.

## Rust API

```rust
use tauri_plugin_deep_link::DeepLinkExt;

tauri::Builder::default()
  .plugin(tauri_plugin_deep_link::init())
  .setup(|app| {
    if let Some(urls) = app.deep_link().get_current()? {
      println!("cold launch urls: {urls:?}");
    }
    app.deep_link().on_open_url(|event| {
      println!("opened with: {:?}", event.urls());
    });

    // Dev-only: register the scheme at runtime so cargo-run builds work.
    #[cfg(all(desktop, debug_assertions))]
    {
      use tauri_plugin_deep_link::DeepLinkExt;
      let _ = app.deep_link().register_all();
    }
    Ok(())
  })
```

## **Critical**: pair with single-instance

A second `myapp://…` launch creates a second process by default — the URL goes to the new process,
not the running window. Almost never what you want.

```sh
npm run tauri add single-instance
```

```rust
tauri::Builder::default()
  .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
    // argv contains the deep-link URL on Windows/Linux.
    // On macOS the plugin's onOpenUrl fires in the original instance directly.
    let _ = app.get_webview_window("main").map(|w| {
      let _ = w.set_focus();
    });
    if let Some(url) = argv.iter().find(|a| a.starts_with("myapp://")) {
      app.emit("deep-link", url.clone()).ok();
    }
  }))
  .plugin(tauri_plugin_deep_link::init())
```

On macOS the OS routes the URL into the existing instance and `onOpenUrl` does the right thing on
its own — but you still need single-instance for Windows/Linux. Always install both.

## Dev-time testing

```sh
# macOS — only the bundled .app in /Applications gets the scheme.
bun run tauri build && open -a /Applications/MyApp.app "myapp://thing/42"

# Linux/Windows — register at runtime in debug, then trigger.
# (the Rust snippet above calls register_all() under debug_assertions)
xdg-open "myapp://thing/42"          # Linux
start "" "myapp://thing/42"          # Windows cmd

# iOS simulator
xcrun simctl openurl booted "myapp://thing/42"

# Android emulator/device
adb shell am start -d "myapp://thing/42" -a android.intent.action.VIEW
```

For iOS App Links during dev, you can short-circuit verification by tapping the link in
Notes/Messages on a device with the dev build installed — Safari direct-loads will not.

## Permission

```json
{
  "permissions": [
    "core:event:default",
    "deep-link:default"
  ]
}
```

`core:event:default` is the one you'll forget — the plugin emits events through the core event bus,
so without it your `onOpenUrl` listener won't see anything.

## Templates

- `templates/setup.rs` — plugin init + single-instance pairing + dev-time register.
- `templates/usage.ts` — cold-launch + warm listener + URL parsing.
- `templates/capability.json` — minimal permissions including the easily-missed
  `core:event:default`.

## Related

- `tauri-plugins` — picking plugins.
- `tauri-events` — `onOpenUrl` is built on the same event bus.
- `tauri-plugin-dev` — if you need a custom variant of deep-link behavior.
