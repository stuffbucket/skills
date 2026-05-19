---
name: tauri-updater-signing-keys
description: Use when managing the Tauri v2 updater's Ed25519 signing keypair — generating it with `bunx tauri signer generate -w ~/.tauri/myapp.key`, embedding the public key in `tauri.conf.json` `plugins.updater.pubkey`, wiring `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` into CI secrets without committing them, and understanding the rotation constraint (old clients can never validate a new public key, so a "rotation" actually means shipping a new app version first with the new key trusted, then phasing the old one out). Pairs with [[tauri-updater]] for the broader plugin setup and [[tauri-bundling]] for OS code signing (a separate signature).
---

# Tauri v2 Updater: Signing Keys

Every update artifact is verified with an Ed25519 signature **before** install.
The plugin will refuse a bundle whose signature doesn't match the embedded
public key — no flag disables this, no env var bypasses it. The signature is
the only thing standing between your users and a mirror-poisoning attacker, so
the key lifecycle deserves the same care as a code-signing cert.

This is **separate from OS code signing** (Apple Developer ID + notarization,
Authenticode, etc.). The Tauri signature proves "this bundle came from the
holder of the private key"; the OS signature proves "this binary is allowed
to run without Gatekeeper / SmartScreen warnings." You need both. See
[[tauri-bundling]] for the OS half.

## 1. Generate the keypair (once, ever)

```sh
bunx tauri signer generate -w ~/.tauri/myapp.key
# also valid:
#   npm run tauri signer generate -- -w ~/.tauri/myapp.key
#   cargo tauri signer generate -w ~/.tauri/myapp.key
```

You'll be prompted for an optional password. **Set one.** It encrypts the
private key at rest; without it, anyone who exfiltrates the file owns your
update channel.

Output:

- `~/.tauri/myapp.key` — **private key**. Signs releases. NEVER commit, NEVER
  lose. Losing it bricks the update channel for every existing install,
  forever.
- `~/.tauri/myapp.key.pub` — **public key**. Embedded literally in
  `tauri.conf.json`.

## 2. Embed the public key

`tauri.conf.json`:

```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDQwQUFFNS4uLgpSV1FUNHk0NzhBdDdLM0FzaktVODJxV0JBcVUyL3lvVEJlMmpkRm04T0RNK2FmaGZJN0VRYldnWAo=",
      "endpoints": [
        "https://releases.myapp.com/{{target}}/{{arch}}/{{current_version}}"
      ]
    }
  }
}
```

The `pubkey` value is the **base64 contents of the `.pub` file**, not a path.
`cat ~/.tauri/myapp.key.pub | base64` if your shell expansion mangles
newlines.

## 3. Pass the private key at build time

`tauri build` reads two env vars. `.env` files are NOT loaded — export them
explicitly in the same shell, or set them as CI secrets.

```sh
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/myapp.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-password"
bunx tauri build
```

You can also pass the **raw key string** as `TAURI_SIGNING_PRIVATE_KEY`
directly (no file needed). This is what CI secrets store — the whole
`untrusted comment:...` blob, newlines and all.

If `createUpdaterArtifacts` is on but those env vars are unset, `tauri build`
**fails**. That's the design — no accidental unsigned releases.

## 4. Storing the private key

Pick one, in rough preference order:

| Where                              | Notes                                                                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1Password / Bitwarden**          | Secure note containing the full key blob + password. Pull into local env via the CLI (`op read 'op://Vault/MyApp Signing Key/private'`) only when releasing locally. |
| **GitHub Actions secrets**         | `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Cannot be read back after entry — re-paste from the password manager if you need to view it.     |
| **Hardware token (YubiKey, etc.)** | Overkill for most teams; only useful if you have a workflow that can drive `minisign` from the token.                                                                |
| **Plain disk**                     | Only `~/.tauri/myapp.key` with `chmod 600`, only on a developer machine you trust, only with a strong password on the key.                                           |

Never:

- Commit the key to the repo (even encrypted).
- Paste it into Slack / issue trackers / Notion.
- Bake it into a Docker image layer.
- Print it in CI logs — `set -x` will leak it. Use GitHub's `::add-mask::`
  if you ever need to interpolate it.

## 5. Rotation is one-way

There is no graceful key rotation. Old clients trust the **one public key**
that shipped in their installed binary; they cannot be told to trust a new
one out-of-band. If you rotate:

1. **Ship a new app version** with the new `pubkey` in `tauri.conf.json`,
   signed by the **old** private key. Existing installs verify and accept it.
2. **Subsequent releases** are signed by the new private key. Installs that
   updated in step 1 can verify them. Installs that **didn't** update in
   step 1 are now stranded — they trust only the old key and will reject
   every future update.
3. After "long enough" (your call — measured in months, by telemetry of who
   actually upgraded), retire the old private key.

Implications:

- Rotation requires a **mandatory update** that you can communicate
  out-of-band. Email, in-app banner, blog post — something that gets
  laggards to install the bridge version manually.
- Losing the private key with no bridge version published means a hard fork:
  ship a brand-new app, ask users to download and reinstall, deprecate the
  old one. There is no recovery.
- For these reasons, treat the keypair as essentially **immutable** for the
  life of the product. Generate it once, secure it well.

## 6. CI signing flow (GitHub Actions sketch)

```yaml
- name: Build signed release
  env:
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
  run: bunx tauri build
```

Verify locally before pushing the secrets: see
`templates/sign-locally.sh` for a one-shot dry-run that builds + signs +
prints the resulting `.sig` filenames so you can confirm the matrix is
producing what you expect.

The full secrets list (including OS-signing creds you'll likely add
alongside) is in `templates/github-actions-secrets-list.md`.

## 7. Common failure modes

| Symptom                                                  | Cause                                                                                                                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signature mismatch` on client during update             | `pubkey` in `tauri.conf.json` doesn't match the private key used to sign. Usually: rotated locally but forgot to bump the embedded pubkey, or built with a stale checkout. |
| `Error: TAURI_SIGNING_PRIVATE_KEY is required`           | `createUpdaterArtifacts: true` but env var unset. Either export it or set `createUpdaterArtifacts: false` for unsigned dev builds.                                         |
| `Error: invalid password`                                | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` empty/wrong. Quote it — passwords with `$` or `!` get mangled by shell expansion.                                                     |
| Old beta-tester installs reject updates after key change | You rotated without a bridge release. Their pubkey is the old one; they need a manual reinstall.                                                                           |

## See also

- [[tauri-updater]] — parent: plugin install, manifest formats, install flow.
- [[tauri-updater-github-releases]] — how to host the signed artifacts.
- [[tauri-updater-install-flow]] — JS/Rust API for triggering an update.
- [[tauri-bundling]] — OS code signing (Apple notarization, Authenticode).
