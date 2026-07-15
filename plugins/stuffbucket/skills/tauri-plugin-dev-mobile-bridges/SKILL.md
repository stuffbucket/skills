---
name: tauri-plugin-dev-mobile-bridges
description: Use when adding iOS (Swift) or Android (Kotlin) native code to a Tauri v2 plugin — `tauri plugin android add` / `ios add` scaffolds, the `@TauriPlugin` Kotlin class with `@Command` methods, the Swift `Plugin` subclass with `@objc func cmd(_ invoke:Invoke)`, marshaling args via `@InvokeArg` / `Decodable`, calling native code from Rust with `PluginHandle::run_mobile_plugin("methodName", payload)`, the `checkPermissions` / `requestPermissions` UX, and debugging the native side in Xcode / Android Studio.
---

# Mobile Bridges in a Tauri v2 Plugin

A mobile-capable Tauri plugin has three layers stacked:

```text
JS  (guest-js)        — invoke('plugin:foo|do_thing', { ... })
 ↓
Rust (src/mobile.rs)  — handle.run_mobile_plugin("doThing", payload)
 ↓
Native (Kotlin/Swift) — @Command fun doThing(invoke: Invoke) / @objc func doThing(_ invoke: Invoke)
```

Desktop bypasses the bottom two layers entirely — `src/desktop.rs` implements the same public API in
pure Rust. The plugin's public Rust struct exposes one method per command, picking the right
implementation behind a `#[cfg(mobile)]` / `#[cfg(desktop)]` split that `tauri plugin new` scaffolds
for you.

Builds on `tauri-plugin-dev` (scaffolding, lifecycle hooks) and
`tauri-plugin-dev-permissions-manifest` (every native command still needs a permission like its
desktop sibling).

## Scaffolding

```sh
# New plugin with both platforms
bunx @tauri-apps/cli plugin new my-plugin --android --ios

# Existing plugin — add one platform later
bunx @tauri-apps/cli plugin android add
bunx @tauri-apps/cli plugin ios add
```

`android add` produces an Android library project under `android/` (Gradle + a Kotlin Plugin class).
`ios add` produces a Swift package under `ios/` (Package.swift + a Swift Plugin class). Both are
referenced from `Cargo.toml` via Tauri's mobile-plugin build glue; you do not have to hand-wire
them.

## Android (Kotlin)

The plugin entry point is a Kotlin class annotated with `@TauriPlugin`. Each `@Command`-annotated
method gets exposed to Rust:

```kotlin
package com.plugin.myplugin

import android.app.Activity
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
internal class OpenCameraArgs {
    lateinit var quality: Integer
    var allowEdit: Boolean = false
}

@TauriPlugin
class MyPlugin(private val activity: Activity) : Plugin(activity) {
    override fun load(webView: WebView) {
        // initialization (called once per webview)
    }

    @Command
    fun openCamera(invoke: Invoke) {
        val args = invoke.parseArgs(OpenCameraArgs::class.java)
        val result = JSObject()
        result.put("path", "/path/to/photo.jpg")
        invoke.resolve(result)
    }
}
```

### Argument marshaling (`@InvokeArg`)

Args come in as JSON; `parseArgs` deserializes to the annotated class. Required vs optional vs
default field shape matters:

- Required: `lateinit var name: String` — missing → exception
- Optional: `var timeout: Int? = null` — missing → `null`
- Default value: `var quality: Int = 100` — missing → `100`

Inner objects must **also** be `@InvokeArg`-annotated.

### Threading & ANR

Commands run on the **main thread**. Block it and you get an Application Not Responding dialog. Wrap
long work in a coroutine and resolve later:

```kotlin
import kotlinx.coroutines.*
val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

@Command
fun loadFile(invoke: Invoke) {
    scope.launch {
        val data = readBigFile()
        invoke.resolve(JSObject().apply { put("data", data) })
    }
}
```

## iOS (Swift)

```swift
import Tauri
import WebKit

class OpenCameraArgs: Decodable {
    let quality: Int
    var allowEdit: Bool?
}

class MyPlugin: Plugin {
    @objc public override func load(webview: WKWebView) {
        // initialization
    }

    @objc public func openCamera(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(OpenCameraArgs.self)
        invoke.resolve(["path": "/path/to/photo.jpg"])
    }
}
```

Each command method **must** be `@objc` and take a single `Invoke` argument — that's how Tauri's
Swift side discovers it via the Objective-C runtime. Drop `@objc` and the command silently doesn't
register.

Optional fields are `var ... : Type?`. Default values are **not supported** — use `nil` and default
at the call site.

## Calling native code from Rust (`src/mobile.rs`)

The scaffold gives you a struct that wraps a `PluginHandle`. Each public Rust method serializes its
args, calls the named native method, and deserializes the result:

```rust
use serde::{Deserialize, Serialize};
use tauri::{plugin::PluginHandle, Runtime};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraRequest {
    pub quality: u32,
    pub allow_edit: bool,
}

#[derive(Deserialize)]
pub struct Photo {
    pub path: std::path::PathBuf,
}

pub struct MyPlugin<R: Runtime>(pub(crate) PluginHandle<R>);

impl<R: Runtime> MyPlugin<R> {
    pub fn open_camera(&self, payload: CameraRequest) -> crate::Result<Photo> {
        self.0
            .run_mobile_plugin("openCamera", payload)
            .map_err(Into::into)
    }
}
```

The string `"openCamera"` must match the Kotlin `fun openCamera` / Swift `func openCamera` name
exactly — camelCase, no `plugin:` prefix.

## The permissions UX (`checkPermissions` / `requestPermissions`)

Some OS features (camera, notifications, location) require runtime user consent. Tauri ships a
standard pattern: every plugin gets two implicit commands, `checkPermissions` and
`requestPermissions`, that consumers call from JS to drive the consent flow.

### Android

Declare the OS permissions you care about on the `@TauriPlugin` annotation:

```kotlin
import android.Manifest
import app.tauri.annotation.Permission

@TauriPlugin(
    permissions = [
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "postNotification"),
        Permission(strings = [Manifest.permission.CAMERA], alias = "camera"),
    ]
)
class MyPlugin(private val activity: Activity) : Plugin(activity) { /* ... */ }
```

Tauri auto-implements `checkPermissions` / `requestPermissions` against these aliases — the JS gets
back `{ postNotification: "granted" | "denied" | "prompt" | "prompt-with-rationale", camera: ... }`.

### iOS

Override the two methods manually — iOS doesn't have a manifest-driven model the way Android does:

```swift
class MyPlugin: Plugin {
    @objc public override func checkPermissions(_ invoke: Invoke) {
        invoke.resolve(["camera": "prompt"])
    }

    @objc public override func requestPermissions(_ invoke: Invoke) {
        AVCaptureDevice.requestAccess(for: .video) { granted in
            invoke.resolve(["camera": granted ? "granted" : "denied"])
        }
    }
}
```

The string values must come from the `PermissionState` set (`granted` / `denied` / `prompt` /
`prompt-with-rationale`) — the JS-side `@tauri-apps/api/core` type checks against that.

## Debugging the native side

- **Android:** open `android/` in Android Studio. Set breakpoints in the Kotlin Plugin class. Run
  the Tauri dev command (`bunx tauri android dev`) — Android Studio attaches to the running process.
  `Log.d(TAG, ...)` shows up in Logcat.
- **iOS:** open the Tauri-generated `.xcworkspace` (under `src-tauri/gen/apple/` of the consuming
  app, not the plugin itself) in Xcode. Set breakpoints in the Swift Plugin class. Run via `bunx
  tauri ios dev`. `print(...)` goes to the Xcode console.
- **Rust ↔ native boundary:** if `run_mobile_plugin("doThing", ...)` errors, the native side either
  (a) doesn't have a method with that exact name, (b) threw an exception before resolving, or (c)
  failed to deserialize the payload (camelCase mismatch is the usual cause — keep
  `#[serde(rename_all = "camelCase")]` on the Rust struct).

## Common traps

- **camelCase mismatch:** Rust serializes `allow_edit` but Kotlin/Swift expects `allowEdit`. Always
  derive `#[serde(rename_all = "camelCase")]` on the Rust args struct.
- **Method-name typo:** `run_mobile_plugin("openCammera", ...)` fails silently as "no such method"
  with no compile-time check. Keep the names in one place if you can.
- **Forgetting `@objc` on Swift:** the method exists at Swift level but Tauri can't see it via the
  Objective-C runtime. It will appear as missing at runtime only.
- **Blocking the Android main thread:** any work over ~16ms in a `@Command` fn freezes the UI. Use
  `CoroutineScope(Dispatchers.IO).launch { ... }` and resolve the Invoke from there.
- **Permission alias collisions:** if two Android plugins both use alias `"notifications"`, the
  runtime can't tell them apart. Prefix with the plugin name (`alias = "my-plugin-notifications"`).

## Templates

- `templates/MyPlugin.kt` — Kotlin `@TauriPlugin` with `@Command`, `@InvokeArg`, permission
  declarations, and a coroutine-backed long-running command.
- `templates/MyPlugin.swift` — Swift `Plugin` subclass with `@objc` commands, `Decodable` args, and
  overridden `checkPermissions` / `requestPermissions`.
- `templates/mobile-bridge.rs` — `src/mobile.rs` skeleton wrapping `PluginHandle::run_mobile_plugin`
  calls.
