# Colima Docker Troubleshooting

## Socket Errors

**Symptom**: `Cannot connect to the Docker daemon at unix:///Users/.../.colima/default/docker.sock`

**Causes & fixes**:

- Colima not running: `colima start`
- Stale DOCKER_HOST after Colima upgrade: Colima >=0.10 moved the socket from `~/.colima/` to `~/.config/colima/`.
  Fix: `export DOCKER_HOST=unix://$HOME/.config/colima/default/docker.sock`
  or unset DOCKER_HOST entirely and let the Docker context handle it: `unset DOCKER_HOST`
- Profile mismatch: `colima list` to see profiles, `colima start -p <name>` to start the right one

## "docker compose" Not Found

**Symptom**: `docker: 'compose' is not a docker command`

**Fix**: Symlink standalone binary as CLI plugin:

```bash
ln -sf $(brew --prefix docker-compose)/bin/docker-compose ~/.docker/cli-plugins/docker-compose
```

## x86_64 Images Slow or Crashing

**Symptom**: x86_64 containers take minutes to start or segfault on ARM64 Mac.

**Fix**: Ensure Rosetta is enabled (requires vz VM type):

```bash
colima stop
colima start --vm-type vz --vz-rosetta
```

If vz is unavailable (older macOS), fall back to qemu with binfmt:

```bash
colima start --vm-type qemu --arch aarch64 --binfmt
```

## VM Won't Start After macOS Update

**Symptom**: `error starting vm: ...hypervisor entitlement`

**Fix**: Delete and recreate the VM:

```bash
colima delete
colima start --vm-type vz --vz-rosetta --memory 8 --cpu 4
```

## Disk Full

**Symptom**: `no space left on device` inside containers.

**Fix**: Prune or increase disk:

```bash
docker system prune -a          # remove unused images/containers
colima stop && colima start --disk 200  # increase disk
```

## Port Conflicts

**Symptom**: `bind: address already in use` on container ports.

**Fix**: Check what's using the port:

```bash
lsof -i :<port>
```

## Mount Performance

virtiofs (default with vz) is fastest. If mounts are slow:

- Verify: `colima list` shows mount-type
- Avoid mounting `node_modules` — use named Docker volumes instead

## Devcontainer Compatibility

Colima runs Docker in root mode by default (daemon as root, socket owned by `root:docker`).
This is the correct setup for devcontainers.
Rootless Docker breaks devcontainers due to UID mapping, port binding, and Docker-in-Docker issues.

If devcontainers can't connect to Docker, check:

```bash
# Verify the Docker socket is accessible
ls -la $(colima ssh -- echo /var/run/docker.sock)
# Verify DOCKER_HOST is set correctly
echo $DOCKER_HOST
# Should point to the Colima socket (see Socket Errors above)
```

## Reset Everything

```bash
colima delete --force
rm -rf ~/.colima/default ~/.config/colima/default
rm -rf ~/.docker/cli-plugins/docker-compose ~/.docker/cli-plugins/docker-buildx
# Then re-run setup
```
