---
name: tauri-plugins-notification
description: Use when sending native OS notifications from a Tauri v2 app — `sendNotification()`, the `isPermissionGranted()` / `requestPermission()` flow (mandatory on macOS first call), Android notification channels, mobile actions / inputs via `registerActionTypes()` + `onAction()`, attachments, custom icons/sounds, and the `notification:default` permission.
---

# Tauri v2: Notification Plugin

Native banner/toast/lockscreen notifications. The plugin abstracts the per-OS surface but the
**permission model** and the **idle behavior** vary enough that "send a notification" is rarely a
one-liner.

## Install

```sh
npm run tauri add notification
```

Manual: `tauri-plugin-notification = "2"`, `@tauri-apps/plugin-notification`,
`.plugin(tauri_plugin_notification::init())`.

## The permission dance (mandatory)

You must ask before you can send. Skipping this on macOS silently no-ops the first
`sendNotification` — and the macOS permission prompt only fires on the **first call to a
notification API in a given session**. So: ask early.

```ts
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

let granted = await isPermissionGranted();
if (!granted) {
  granted = (await requestPermission()) === 'granted';
}
if (granted) {
  sendNotification({ title: 'Build done', body: 'Tests passed in 14.2s' });
}
```

| OS      | First-call behavior                                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS   | Shows system prompt the first time. If the user dismisses with Esc/click-out, you'll get `default`, not `granted` or `denied`. Treat anything ≠ `granted` as not-allowed. |
| Windows | Granted by default for installed apps; sideloaded/dev builds may show in Action Center but not as toasts.                                                                 |
| Linux   | Backed by libnotify / D-Bus; usually no permission UI, "granted" is the default.                                                                                          |
| iOS     | Required, like macOS. Must request before any send.                                                                                                                       |
| Android | API 33+ requires runtime permission; below that, granted on install.                                                                                                      |

## `sendNotification` options

```ts
sendNotification({
  title: 'Required',
  body: 'optional body text',
  icon: 'icons/icon.png',        // app-bundled icon path
  sound: 'default',              // 'default' | path
  attachments: [                 // images/media inline (mac/iOS)
    { id: 'thumb', url: 'asset://localhost/thumb.png' },
  ],
  // Mobile:
  channelId: 'builds',           // Android — see below
  actionTypeId: 'build-actions', // Mobile — see below
});
```

Most fields degrade gracefully on platforms that don't support them. The minimum useful payload is
`{ title, body }`.

## Android: notification channels

Android 8+ requires every notification to belong to a channel. Channels carry the importance, sound,
vibration, and lights settings — users tune them in system settings.

```ts
import { createChannel, Importance, Visibility } from '@tauri-apps/plugin-notification';

await createChannel({
  id: 'builds',
  name: 'Build status',
  importance: Importance.High,
  visibility: Visibility.Private,
  sound: 'default',
  vibration: true,
  lights: true,
});

await sendNotification({ channelId: 'builds', title: 'Done', body: 'OK' });
```

Channel ids are stable identifiers — once created, the user owns them. Don't recreate one with
different defaults expecting the new defaults to stick.

## Mobile actions and inputs

Action types are registered up-front, then referenced by id on sends.

```ts
import { registerActionTypes, onAction } from '@tauri-apps/plugin-notification';

await registerActionTypes([
  {
    id: 'build-actions',
    actions: [
      { id: 'rerun',  title: 'Re-run',  foreground: true },
      { id: 'reply',  title: 'Comment', input: true, inputPlaceholder: 'Note…' },
    ],
  },
]);

await onAction((event) => {
  console.log(event.actionId, event.userText); // userText set if input: true
});
```

Actions are essentially a mobile-only feature; on desktop they degrade to no buttons.

## Scheduled notifications

`schedule` field on the payload, plus the matching permission. Concretely:

```ts
import { sendNotification } from '@tauri-apps/plugin-notification';

await sendNotification({
  title: 'Stand-up',
  body: 'Daily at 09:30',
  schedule: { at: new Date(Date.now() + 60_000) },        // one-shot
  // schedule: { interval: { hour: 9, minute: 30 } },     // recurring (mobile)
});
```

Recurring schedules are mobile-only; on desktop you get one-shot only.

## Custom icons and sounds

- `icon`: path relative to your bundled resources (`asset://` style). On Linux, the icon must be an
  installed theme name or a `.desktop`-registered icon for some daemons.
- `sound`: `'default'` for the system tone, or a path to a `.caf` / `.wav` / etc.; format support
  varies by OS. On Android, sounds must be set on the **channel**, not the per-send payload.

## Rust API

```rust
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
fn ping(app: tauri::AppHandle) -> Result<(), String> {
    app.notification()
        .builder()
        .title("Hello")
        .body("From Rust")
        .show()
        .map_err(|e| e.to_string())
}
```

`builder()` mirrors the JS options. Useful when the trigger is server-side or a background tokio
task.

## Permission

```json
{ "permissions": ["notification:default"] }
```

`notification:default` includes send + permission queries. Mobile actions and channel CRUD have
their own narrower identifiers if you want a tighter capability.

## Common pitfalls

1. **macOS no-op on first send** — you forgot the `requestPermission()` step; OR your app isn't
   signed/bundled, so it can't request. Run from a bundled `.app` in `/Applications` for realistic
   testing.
2. **Windows toast doesn't appear** — Focus Assist / "Do Not Disturb" is on, or your app isn't
   registered with the Action Center yet. Bundled installer fixes the registration.
3. **Android silent** — missing `channelId`, or notification permission denied on API 33+.
4. **Linux nothing** — `libnotify` not installed, or no daemon running (GNOME / KDE / dunst / mako).

## Templates

- `templates/setup.rs` — plugin init + a Rust-side ping command.
- `templates/usage.ts` — permission dance + channel + scheduled.
- `templates/capability.json` — minimal permission.

## Related

- `tauri-plugins` — overall picker.
- `tauri-plugins-deep-link` — pairs with notification actions on mobile when tapping a notification
  should route into the app.
