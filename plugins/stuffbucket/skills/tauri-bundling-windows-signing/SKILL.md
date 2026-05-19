---
name: tauri-bundling-windows-signing
description: Use when signing a Tauri v2 Windows installer (MSI or NSIS) for SmartScreen reputation and trusted-installer UX — provisioning a code-signing cert (PFX, Azure Key Vault via relic, or Azure Trusted Signing), wiring `WINDOWS_CERTIFICATE` (base64 PFX) + `WINDOWS_CERTIFICATE_PASSWORD` env vars or a custom `signCommand`, choosing MSI vs NSIS, picking the right WebView2 install mode, warming up SmartScreen reputation, and submitting to the Microsoft Store.
---

# Tauri v2 — Windows signing & installer

Pairs with [[tauri-bundling]] (host skill) and [[tauri-bundling-github-actions]] (CI wiring).

End-state: on a fresh Windows 11 box, double-clicking the installer shows the publisher name (not
"Unknown publisher"), no red SmartScreen "Windows protected your PC" wall, and the install completes
silently. That requires (1) a code-signing certificate, (2) it embedded in the installer via
signtool, and (3) — for SmartScreen reputation — either an EV cert (instant trust) or volume + time
with a regular OV cert.

---

## 1. MSI vs NSIS — pick before you sign

Tauri ships two Windows installer formats. The output goes to
`src-tauri/target/release/bundle/{msi,nsis}/`.

|                                   | MSI (WiX v3)             | NSIS (`-setup.exe`)                     |
| --------------------------------- | ------------------------ | --------------------------------------- |
| Build host                        | Windows only             | Windows / macOS / Linux (cross-compile) |
| Install scope                     | Per-machine or per-user  | Per-machine or per-user                 |
| Size overhead                     | ~2 MB WiX runtime        | ~250 KB                                 |
| Custom install UI                 | Limited (WiX dialog set) | Full NSIS scripting                     |
| Silent install flag               | `/qn`                    | `/S`                                    |
| MS Store                          | Supported                | Supported                               |
| Auto-update via [[tauri-updater]] | Yes                      | Yes (recommended — smaller delta)       |

```sh
bun run tauri build --bundles msi          # MSI only
bun run tauri build --bundles nsis         # NSIS only
bun run tauri build --bundles msi,nsis     # both
```

**Default to NSIS** unless you have a corporate IT requirement for MSI (GPO deployment via Active
Directory). Smaller, cross-compilable, friendlier updater behavior.

---

## 2. Signing with a PFX certificate (simplest path)

You have a `.pfx` file from a CA (DigiCert, Sectigo, SSL.com, …). Two ways to wire it:

### A. `WINDOWS_CERTIFICATE` env vars (Tauri-native, CI-friendly)

```sh
# Base64-encode the .pfx once:
certutil -encode certificate.pfx base64cert.txt
# (Or on macOS/Linux: base64 -w 0 certificate.pfx > base64cert.txt)
# Paste contents into the WINDOWS_CERTIFICATE secret.

# Then for the build:
$env:WINDOWS_CERTIFICATE = "<base64 from above>"
$env:WINDOWS_CERTIFICATE_PASSWORD = "<pfx export password>"
bun run tauri build --bundles nsis
```

Tauri base64-decodes into a temp `.pfx`, calls `signtool sign /f <pfx> /p <pass> /tr <timestampUrl>
/td sha256 /fd sha256 ...` on the produced installer, then deletes the temp file. Output line on
success: `Successfully signed: APPLICATION FILE PATH HERE`.

### B. Certificate thumbprint (cert already in Windows cert store)

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "A1B1A2B2A3B3A4B4A5B5A6B6A7B7A8B8A9B9A0B0",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.comodoca.com"
    }
  }
}
```

Use when the cert lives in `Cert:\CurrentUser\My` (typical for developer workstations and
self-hosted Windows runners). Get the thumbprint:

```powershell
Get-ChildItem -Path Cert:\CurrentUser\My -CodeSigningCert | Format-List Subject,Thumbprint
```

Always set a `timestampUrl` — without a countersigned timestamp, the signature *expires when the
cert expires* and your already-shipped installers stop validating. Common public timestamp servers:
`http://timestamp.digicert.com`, `http://timestamp.sectigo.com`, `http://timestamp.comodoca.com`.

---

## 3. Azure Key Vault via `relic` (no PFX leaves the vault)

Modern best practice — the private key never lands on the build agent. Install `relic`
(<https://github.com/sassoftware/relic>), configure it to talk to Key Vault, and point Tauri at it
via `signCommand`.

`relic.conf`:

```yml
tokens:
  azure:
    type: azure

keys:
  azure:
    token: azure
    id: https://<KEY_VAULT_NAME>.vault.azure.net/certificates/<CERTIFICATE_NAME>
```

`tauri.conf.json`:

```json
{
  "bundle": {
    "windows": {
      "signCommand": "relic sign --file %1 --key azure --config relic.conf"
    }
  }
}
```

Env vars (service principal with Key Vault `Get` + `Sign` permissions):

```sh
AZURE_CLIENT_ID=...
AZURE_TENANT_ID=...
AZURE_CLIENT_SECRET=...
```

Tauri replaces `%1` with each artifact to sign. The relic process talks to KV over HTTPS and returns
the signed bytes.

---

## 4. Azure Trusted Signing (the new EV-less path)

As of 2024 Microsoft offers **Trusted Signing** — a hosted signing service that gives you
SmartScreen reputation comparable to an EV cert at ~$10/month, no hardware token, no annual renewal
dance. Use `trusted-signing-cli` (<https://github.com/Levminer/trusted-signing-cli>):

```json
{
  "bundle": {
    "windows": {
      "signCommand": "trusted-signing-cli -e https://wus2.codesigning.azure.net -a MyAccount -c MyProfile -d MyApp %1"
    }
  }
}
```

Env vars (same service-principal pattern):

```sh
AZURE_CLIENT_ID=...
AZURE_TENANT_ID=...
AZURE_CLIENT_SECRET=...
```

`-e` is the regional endpoint, `-a` is the Trusted Signing account name, `-c` is the certificate
profile, `-d` is a human-readable description that shows in the UAC prompt.

**This is the recommended path for new projects** — better UX than waiting months for OV-cert
SmartScreen reputation, cheaper than EV tokens, no HSM logistics.

---

## 5. WebView2 install mode — decide before you ship the first build

WebView2 is Tauri's webview on Windows. It's preinstalled on Windows 11 and most Windows 10 — but
not all. You pick how the installer handles a missing runtime:

| Mode                             | Installer size | UX                                                     | When                                               |
| -------------------------------- | -------------- | ------------------------------------------------------ | -------------------------------------------------- |
| `downloadBootstrapper` (default) | +0             | Downloads bootstrapper at install time, needs internet | General release where most users are online        |
| `embedBootstrapper`              | +1.8 MB        | Bootstrapper embedded, downloads runtime at install    | Win7 MSI support                                   |
| `offlineInstaller`               | +127 MB        | Full runtime embedded, no internet needed              | Enterprise / air-gapped / MS Store (**required**)  |
| `fixedRuntime`                   | +variable      | Pins a specific WebView2 build, no auto-update         | Regulated software where you want a frozen WebView |
| `skip`                           | +0             | No check — app crashes if runtime missing              | Only when you control the install environment      |

```json
{
  "bundle": {
    "windows": {
      "webviewInstallMode": { "type": "offlineInstaller" }
    }
  }
}
```

`fixedRuntime` variant:

```json
{
  "bundle": {
    "windows": {
      "webviewInstallMode": {
        "type": "fixedRuntime",
        "path": "./Microsoft.WebView2.FixedVersionRuntime.98.0.1108.50.x64/"
      }
    }
  }
}
```

---

## 6. SmartScreen reputation — why your signed installer still gets flagged

A freshly signed installer with an OV (organization-validated) cert still shows the SmartScreen
"Windows protected your PC" wall until Microsoft's reputation system warms up. That requires:

1. **The cert itself.** OV is fine; EV gives instant reputation.
2. **Volume.** A few hundred user-side installs.
3. **Time.** Days to weeks of telemetry.
4. **Consistency.** Don't re-issue the cert frequently; reputation attaches to the cert, not the
   publisher.

Mitigations while you warm up:

- Ship a download page that explains the "More info → Run anyway" path.
- Use **Azure Trusted Signing** (section 4) — it issues short-lived certs but Microsoft tracks
  reputation at the account level, so you get reputation faster than rotating OV certs would
  normally allow.
- Don't change the publisher name or cert subject between releases.

---

## 7. Microsoft Store submission

Three requirements that differ from regular distribution:

1. **WebView2 install mode must be `offlineInstaller`** — the Store doesn't allow runtime downloads
   at install time.
2. **Publisher name must not match product name** — and must match exactly what you reserved in
   Partner Center. If unset, Tauri derives it from your bundle identifier's second component
   (`com.example.app` → "example"). Set explicitly:

   ```json
   { "bundle": { "publisher": "Example Inc." } }
   ```

3. **Installer must be code-signed.**

Practical pattern: use a separate `tauri.microsoftstore.conf.json` that overrides
`webviewInstallMode` to `offlineInstaller` and any Store-specific bundle metadata. Build with:

```sh
bun run tauri build --bundles msi --config tauri.microsoftstore.conf.json
```

Then in Partner Center: *Apps and Games → New product → EXE or MSI app*, reserve the name, upload
the installer to a hosted URL (Azure Blob, S3), and paste the link into the Store listing. The Store
doesn't host the bytes — it links out.

---

## 8. Common errors

| Symptom                                                                      | Cause                                                                                         | Fix                                                                              |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `SignTool Error: No certificates were found that met all the given criteria` | Thumbprint typo, or cert not in `CurrentUser\My`                                              | `Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert`; copy the exact thumbprint |
| `The specified PFX password is not correct`                                  | Wrong `WINDOWS_CERTIFICATE_PASSWORD`, or PFX exported without password but env var set anyway | Re-export, or unset the password env var                                         |
| `Successfully signed` but SmartScreen still flags                            | OV cert with no reputation yet                                                                | Wait, or switch to EV / Trusted Signing                                          |
| `signtool.exe not found`                                                     | Windows SDK not installed                                                                     | Install via VS Build Tools or `winget install Microsoft.WindowsSDK`              |
| Updater downloads new MSI, install silently fails                            | MSI per-machine vs per-user mismatch                                                          | Pick one install scope (NSIS makes this easier)                                  |
| MS Store rejects with "not offline installer"                                | `webviewInstallMode` set to `downloadBootstrapper`                                            | Switch to `offlineInstaller` for Store builds                                    |
| WebView2 missing on Windows 7/8.1                                            | `downloadBootstrapper` doesn't work pre-Win10 reliably                                        | Use `embedBootstrapper` or `offlineInstaller`                                    |

---

## See also

- [[tauri-bundling]] — host skill
- [[tauri-bundling-github-actions]] — full release workflow including Windows secrets
- [[tauri-updater]] — auto-updates (separate signature)
- `templates/sign-windows.ps1` — standalone signtool wrapper for manual signing
- `templates/tauri.conf.windows.json` — bundle.windows config snippet (signing + WebView2 +
  publisher)
