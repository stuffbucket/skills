# GitHub Actions Secrets for Tauri v2 Signed Releases

Add at: **Settings → Secrets and variables → Actions → New repository secret**.

## Required for the Tauri updater signature

| Secret name | Value |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Full contents of `~/.tauri/myapp.key` (the `untrusted comment: ...` blob, newlines included). Paste the whole file. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The password you set when running `tauri signer generate`. Empty string only if you generated without a password (don't). |

## Usually paired (OS code signing — see [[tauri-bundling]])

### macOS

| Secret name | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` of your Developer ID Application cert. `base64 -i cert.p12 \| pbcopy`. |
| `APPLE_CERTIFICATE_PASSWORD` | Password protecting the `.p12`. |
| `APPLE_SIGNING_IDENTITY` | Common Name of the cert, e.g. `Developer ID Application: My Co (TEAMID)`. |
| `APPLE_ID` | Apple ID email used for notarization. |
| `APPLE_PASSWORD` | App-specific password for `APPLE_ID` (generated at appleid.apple.com). |
| `APPLE_TEAM_ID` | 10-char team identifier from Apple Developer portal. |

### Windows

| Secret name | Value |
| --- | --- |
| `WINDOWS_CERTIFICATE` | Base64-encoded `.pfx` of your Authenticode cert. |
| `WINDOWS_CERTIFICATE_PASSWORD` | Password for the `.pfx`. |

## Verification checklist

Before your first release run:

- [ ] Each secret pasted via the GitHub web UI (not committed, not in env files).
- [ ] `TAURI_SIGNING_PRIVATE_KEY` round-trips: paste it back in a scratch
      file locally, confirm `bunx tauri signer sign --private-key <file>`
      works.
- [ ] Password secrets have no trailing whitespace (GitHub doesn't trim).
- [ ] Workflow uses `env:` block at the **step** level, not `run:` interpolation
      (interpolated secrets leak into logs).
- [ ] At least one human on the team has a 1Password copy of every secret —
      GitHub will not show them again after entry.

## Rotation procedure

If a secret leaks:

1. Generate a replacement immediately.
2. Update the GitHub secret (overwrites, same name).
3. For the **Tauri signing key** specifically: see [[tauri-updater-signing-keys]]
   §5 — rotation requires a bridge release. The OS signing certs rotate
   freely.
