import {
  readTextFile,
  writeTextFile,
  readTextFileLines,
  open,
  watch,
  mkdir,
  exists,
  BaseDirectory,
} from '@tauri-apps/plugin-fs';

// Simple read/write, always via BaseDirectory — never hard-code absolute paths.
const cfg = await readTextFile('config.toml', { baseDir: BaseDirectory.AppConfig });
await writeTextFile('app.log', `started at ${new Date().toISOString()}\n`, {
  baseDir: BaseDirectory.AppLog,
});

// Ensure a subdir exists before writing into it.
if (!(await exists('cache', { baseDir: BaseDirectory.AppData }))) {
  await mkdir('cache', { baseDir: BaseDirectory.AppData, recursive: true });
}

// Streaming read for large files.
const lines = await readTextFileLines('huge.log', { baseDir: BaseDirectory.AppLog });
for await (const line of lines) {
  if (line.includes('ERROR')) console.warn(line);
}

// Open with append mode for log-style writes.
const file = await open('events.log', {
  write: true,
  append: true,
  create: true,
  baseDir: BaseDirectory.AppData,
});
await file.write(new TextEncoder().encode('event\n'));
await file.close();

// Watch — returns an unlisten function; call it on teardown.
const stop = await watch(
  'app.log',
  (event) => console.log(event.type, event.paths),
  { baseDir: BaseDirectory.AppLog, delayMs: 250 },
);
// later: stop();
