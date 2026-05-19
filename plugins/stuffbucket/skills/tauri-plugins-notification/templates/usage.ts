import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
  createChannel,
  registerActionTypes,
  onAction,
  Importance,
  Visibility,
} from '@tauri-apps/plugin-notification';

/**
 * Call this once at app boot. Anything ≠ 'granted' is "not allowed", including
 * macOS 'default' (user dismissed the prompt without choosing).
 */
export async function ensureNotifications(): Promise<boolean> {
  if (await isPermissionGranted()) return true;
  const result = await requestPermission();
  return result === 'granted';
}

/** Mobile: Android channels must exist before sending into them. */
export async function setupChannels() {
  await createChannel({
    id: 'builds',
    name: 'Build status',
    importance: Importance.High,
    visibility: Visibility.Private,
    sound: 'default',
    vibration: true,
    lights: true,
  });
}

/** Mobile: action buttons + text-input on the notification. */
export async function setupActions() {
  await registerActionTypes([
    {
      id: 'build-actions',
      actions: [
        { id: 'rerun', title: 'Re-run', foreground: true },
        { id: 'reply', title: 'Comment', input: true, inputPlaceholder: 'Note…' },
      ],
    },
  ]);

  await onAction((event) => {
    console.log('action', event.actionId, event.userText);
  });
}

export async function notifyBuildDone(name: string, ms: number) {
  if (!(await ensureNotifications())) return;
  await sendNotification({
    title: 'Build done',
    body: `${name} passed in ${(ms / 1000).toFixed(1)}s`,
    icon: 'icons/icon.png',
    channelId: 'builds',       // ignored on desktop
    actionTypeId: 'build-actions', // ignored on desktop
  });
}

/** One-shot in N ms — desktop-compatible. */
export async function remindIn(ms: number, title: string) {
  if (!(await ensureNotifications())) return;
  await sendNotification({
    title,
    schedule: { at: new Date(Date.now() + ms) },
  });
}
