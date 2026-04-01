---
name: colima-docker-setup
description: Set up Docker, docker compose, and docker buildx on macOS using Colima. Use when Docker Desktop is not available, Colima needs install or config, docker compose v2 plugin is missing, x86_64 emulation via Rosetta is needed on Apple Silicon, or diagnosing socket errors and slow x64 containers.
---

# Colima Docker Setup

Set up Docker CLI + compose + buildx on macOS using Colima as the container runtime.

## Quick Setup

Run the bundled setup script — it is idempotent:

```bash
bash <skill_dir>/scripts/setup.sh
```

This performs all steps: install, plugin symlinks, Colima start, verify.

### Individual Steps

```bash
bash <skill_dir>/scripts/setup.sh install   # brew install colima docker docker-compose docker-buildx
bash <skill_dir>/scripts/setup.sh plugins   # symlink compose + buildx as docker CLI plugins
bash <skill_dir>/scripts/setup.sh colima    # create and start the default profile
bash <skill_dir>/scripts/setup.sh verify    # check everything works
bash <skill_dir>/scripts/setup.sh status    # alias for verify
bash <skill_dir>/scripts/setup.sh stop      # stop the Colima VM
```

### Configuration via Environment Variables

| Variable | Default | Purpose |
| ---------- | --------- | --------- |
| `COLIMA_CPUS` | 4 | VM CPU count |
| `COLIMA_MEMORY` | 8 | VM memory (GiB) |
| `COLIMA_DISK` | 100 | VM disk (GiB) |
| `COLIMA_PROFILE` | default | Colima profile name |
| `COLIMA_VM_TYPE` | vz | VM type (vz or qemu) |

Example with custom resources:

```bash
COLIMA_MEMORY=16 COLIMA_CPUS=8 bash <skill_dir>/scripts/setup.sh
```

## Colima Default Template

To persist defaults across all future `colima start` invocations:

```bash
mkdir -p ~/.colima/_templates
cp <skill_dir>/assets/colima-template.yaml ~/.colima/_templates/default.yaml
```

Edit `~/.colima/_templates/default.yaml` to customize. CLI flags override template values.

## Key Facts

- **vz + Rosetta** (Apple Virtualization Framework) is required for performant x86_64 containers on ARM64 Macs. Without Rosetta, QEMU emulation is ~10x slower.
- `docker compose` (v2 plugin syntax with space) requires the compose binary symlinked into `~/.docker/cli-plugins/`. The setup script handles this.
- DOCKER_HOST should be `unix://$HOME/.colima/default/docker.sock` — Colima sets this automatically when `--activate` is used.
- virtiofs is the fastest mount type with vz. `$HOME` is mounted writable by default.

## Troubleshooting

Read `<skill_dir>/references/troubleshooting.md` for common issues:
socket errors, missing compose plugin, slow x64 containers, VM startup failures, disk full, port conflicts.
