---
name: npm-trusted-publishing
description: "Publish npm packages from GitHub Actions using OIDC trusted publishing with provenance. USE FOR: setting up npm publish workflows, debugging 404/401/403 errors on npm publish, configuring --provenance, fixing 'not in this registry' errors. DO NOT USE FOR: general npm usage, installing packages, or non-GitHub CI."
license: MIT
metadata:
  category: ci-cd
  domain: npm
---

# npm Trusted Publishing from GitHub Actions

## When to Use

- Setting up a new npm package to publish from GitHub Actions without secrets
- Debugging `E404 Not Found` on `npm publish --provenance` from CI
- Reviewing an existing release workflow for correct OIDC configuration

## How It Works

npm supports token-free publishing via GitHub Actions OIDC. The GitHub Actions runner requests an OIDC token from GitHub, which npm verifies against the package's linked repository. No `NPM_TOKEN`
secret is needed.

**Version requirement: npm >= 11.5.1 and Node >= 22.14.0.** Older npm versions support `--provenance` signing but NOT the OIDC token exchange for authentication. Use **node 24** in your workflow to
be safe. Node 22 LTS ships with npm 10.x which is too old — provenance will sign successfully but the PUT will 404.

## Required Configuration

All three of these must be in place. If any is missing, publish fails with a misleading 404.

### 1. package.json — `repository` field

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/OWNER/REPO.git"
  }
}
```

npm uses this to match the OIDC token's provenance claim to the package.

### 2. npmjs.com — Trusted Publishing link

On npmjs.com → package Settings → Publishing access → Trusted Publishing:

- Repository owner: `OWNER`
- Repository name: `REPO`
- Workflow filename: `release.yml` (must match exactly, including extension)
- Environment: leave blank unless the workflow job uses a GitHub environment

npm does NOT validate this config when you save it — errors only surface at publish time.

### 3. GitHub Actions workflow

See [./resources/release-workflow.yml](./resources/release-workflow.yml) for a working example from this repo.

Key requirements:

- **node-version: 24** — npm trusted publishing requires npm >= 11.5.1 (node 22 ships npm 10.x = too old)
- `id-token: write` — allows the runner to request an OIDC token
- `registry-url: https://registry.npmjs.org` on setup-node — configures `.npmrc` for the OIDC auth flow
- `--provenance` is optional — provenance is automatic with OIDC trusted publishing
- **No `NODE_AUTH_TOKEN` env var needed** — the OIDC token handles auth

### Optional: Separate publish job

For cleaner permission scoping, split build and publish into separate jobs. See [./resources/split-jobs-example.yml](./resources/split-jobs-example.yml).

## Debugging Checklist

When `npm publish` fails with 404 from GitHub Actions:

1. **Check Node version** — must be 24+ (npm >= 11.5.1). This is the #1 cause. Node 22 LTS ships npm 10.x which signs provenance fine but cannot do the OIDC token exchange for auth.
2. **Check `repository` field in package.json** — must be present and match the GitHub repo exactly (case-sensitive). `"url": "git+https://github.com/OWNER/REPO.git"`.
3. **Check npmjs.com trusted publishing settings** — the repo owner, repo name, and workflow filename must all match exactly.
4. **Check `id-token: write`** — must be in the job's permissions (or top-level workflow permissions).
5. **Check `registry-url`** — must be `https://registry.npmjs.org` in the `actions/setup-node` step.
6. **Do NOT add `NODE_AUTH_TOKEN`** — this is not needed for trusted publishing and mixing token auth with OIDC can cause conflicts.

## Verifying a Package Uses OIDC

```bash
curl -s https://registry.npmjs.org/@scope/pkg | python3 -c "
import json, sys
d = json.load(sys.stdin)
v = list(d['versions'].values())[-1]
print('attestations:', 'attestations' in v.get('dist', {}))
print('_npmUser:', v.get('_npmUser'))
"
```

- `attestations: True` + `_npmUser` contains `trustedPublisher` → OIDC trusted publishing is working
- `attestations: False` + `_npmUser` is a human account → published with a token

## Common Errors

| Error | Cause |
| ------- | ------- |
| `E404 Not Found - PUT` (provenance signs OK) | **npm version too old** (need >= 11.5.1, use node 24). Or: missing `repository` field. Or: trusted publishing not linked on npmjs.com |
| `E404 Not Found - PUT` (no provenance) | Missing `id-token: write` permission or `registry-url` not set |
| `E403 Forbidden` | Workflow filename or environment mismatch in npmjs settings |
| `ENEEDAUTH` | Missing `registry-url` in setup-node step |

## Misleading Behavior

**Provenance signing succeeds but publish fails with 404.** This is the most confusing failure mode. The `--provenance` flag uses the OIDC token to sign a Sigstore attestation (works on npm 9.5+),
but the OIDC token exchange for _publish authentication_ is a separate, newer feature (npm 11.5.1+).
You'll see "Signed provenance statement" in the logs and then immediately get a 404 on the PUT.
The fix is always: use node 24.
