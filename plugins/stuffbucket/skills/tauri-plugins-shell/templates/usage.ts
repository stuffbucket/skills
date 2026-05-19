import { Command } from '@tauri-apps/plugin-shell';
import { openUrl, openPath, revealItemInDir } from '@tauri-apps/plugin-opener';

// --- shell: one-shot exec ----------------------------------------------------
const out = await Command.create('git-status', []).execute();
if (out.code !== 0) throw new Error(`git failed: ${out.stderr}`);
console.log(out.stdout);

// --- shell: long-running sidecar with streaming ------------------------------
const proxy = Command.sidecar('proxy', ['--port', '4142']);

proxy.stdout.on('data', (line) => console.log('[proxy]', line));
proxy.stderr.on('data', (line) => console.warn('[proxy:err]', line));
proxy.on('close', ({ code, signal }) => {
  console.log(`proxy exited code=${code} signal=${signal}`);
});

const child = await proxy.spawn();

// stdin write — needs shell:allow-stdin-write
await child.write('reload\n');

// On app teardown — needs shell:allow-kill
window.addEventListener('beforeunload', () => {
  child.kill().catch(() => {});
});

// --- opener -----------------------------------------------------------------
await openUrl('https://tauri.app/start/');
await openPath('/Users/me/Downloads/report.pdf');
await revealItemInDir('/Users/me/Downloads/report.pdf');
