#!/usr/bin/env python3
"""
apply_figma_make.py — Integrate a Figma Make ZIP export into a Vite project.

Usage:
    python3 skills/figma-make-to-vite/scripts/apply_figma_make.py
    python3 skills/figma-make-to-vite/scripts/apply_figma_make.py --zip contrib/MyPrototype.zip
    python3 skills/figma-make-to-vite/scripts/apply_figma_make.py --force

Steps:
  1. Locate ZIP (auto-detect ./contrib/*.zip or ./*.zip if --zip not given)
  2. Extract to /tmp/figma-<slug>-<epoch>/
  3. Validate it is a Figma Make export
  4. Scaffold ./ if no package.json exists, else merge
  5. Install dependencies
  6. TypeScript type-check
  7. Report
"""

import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def die(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def info(msg: str) -> None:
    print(f"  {msg}")


def run(cmd: list[str], cwd: Path) -> subprocess.CompletedProcess:
    """Run a command, streaming output to the terminal."""
    return subprocess.run(cmd, cwd=cwd, check=True)


def find_zip(project_root: Path) -> Path:
    """Search contrib/ then ./ for exactly one ZIP. Returns its path."""
    candidates = sorted(glob.glob(str(project_root / "contrib" / "*.zip")))
    if not candidates:
        candidates = sorted(glob.glob(str(project_root / "*.zip")))
    if len(candidates) == 0:
        die(
            "No ZIP file found in ./contrib/ or ./. "
            "Pass --zip <path> to specify one explicitly."
        )
    if len(candidates) > 1:
        die(
            f"Multiple ZIP files found:\n"
            + "\n".join(f"  {c}" for c in candidates)
            + "\nPass --zip <path> to specify which one to use."
        )
    return Path(candidates[0])


def slugify(name: str) -> str:
    """Convert a filename stem to a safe directory slug."""
    name = name.lower()
    name = re.sub(r"[^a-z0-9]+", "-", name)
    return name.strip("-")


def extract_zip(zip_path: Path) -> Path:
    """Extract ZIP to a fresh /tmp directory. Returns the extract root."""
    slug = slugify(zip_path.stem)
    epoch = int(time.time())
    dest = Path(tempfile.gettempdir()) / f"figma-{slug}-{epoch}"
    dest.mkdir(parents=True, exist_ok=True)
    print(f"\n[1/7] Extracting {zip_path.name} → {dest}")
    with zipfile.ZipFile(zip_path, "r") as zf:
        # Security: reject paths with absolute components or path traversal
        for member in zf.namelist():
            member_path = Path(member)
            if member_path.is_absolute() or ".." in member_path.parts:
                die(f"ZIP contains unsafe path: {member}")
        zf.extractall(dest)
    return dest


def validate_extract(extract_dir: Path) -> None:
    """Confirm the extracted directory looks like a Figma Make export."""
    required = ["src/main.tsx", "vite.config.ts", "package.json"]
    missing = [r for r in required if not (extract_dir / r).exists()]
    if missing:
        die(
            f"The ZIP does not appear to be a Figma Make export. "
            f"Missing: {', '.join(missing)}"
        )
    print("[2/7] Validated: looks like a Figma Make export.")


# ---------------------------------------------------------------------------
# package.json merging
# ---------------------------------------------------------------------------

def _version_key(version: str) -> tuple:
    """
    Crude semver sort key. Strips leading ^ ~ and splits on dots.
    Used only to pick the higher of two conflicting versions.
    """
    clean = re.sub(r"^[^0-9]*", "", version)
    parts = re.split(r"[.\-]", clean)
    result = []
    for p in parts[:3]:
        try:
            result.append(int(p))
        except ValueError:
            result.append(0)
    while len(result) < 3:
        result.append(0)
    return tuple(result)


def merge_package_json(existing_path: Path, incoming_path: Path) -> None:
    """
    Merge dependencies and devDependencies from incoming into existing.
    Where a package exists in both, keep the higher version string.
    Writes the result back to existing_path.
    """
    with existing_path.open() as f:
        existing = json.load(f)
    with incoming_path.open() as f:
        incoming = json.load(f)

    changed = []
    for section in ("dependencies", "devDependencies"):
        existing.setdefault(section, {})
        for pkg, ver in incoming.get(section, {}).items():
            if pkg not in existing[section]:
                existing[section][pkg] = ver
                changed.append(f"  + {section}/{pkg}@{ver}")
            else:
                current = existing[section][pkg]
                if _version_key(ver) > _version_key(current):
                    existing[section][pkg] = ver
                    changed.append(f"  ↑ {section}/{pkg}: {current} → {ver}")

    with existing_path.open("w") as f:
        json.dump(existing, f, indent=2)
        f.write("\n")

    if changed:
        info("package.json — merged dependencies:")
        for line in changed:
            info(line)
    else:
        info("package.json — no new dependencies to add.")


# ---------------------------------------------------------------------------
# File copy helpers
# ---------------------------------------------------------------------------

def copy_tree(src: Path, dst: Path, force: bool = False) -> list[str]:
    """
    Recursively copy src/ into dst/.
    Skips existing files unless force=True.
    Returns list of copied paths (relative to dst).
    """
    copied = []
    for item in src.rglob("*"):
        if item.is_dir():
            continue
        rel = item.relative_to(src)
        target = dst / rel
        if target.exists() and not force:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, target)
        copied.append(str(rel))
    return copied


def copy_file_if_missing(src: Path, dst: Path) -> bool:
    """Copy src to dst only if dst does not already exist. Returns True if copied."""
    if dst.exists():
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return True


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def scaffold_fresh(extract_dir: Path, project_root: Path) -> None:
    """No package.json in project_root — copy everything from the extract."""
    print("[3/7] Fresh project — copying Figma Make export to ./")
    copied = []
    for item in extract_dir.rglob("*"):
        if item.is_dir():
            continue
        rel = item.relative_to(extract_dir)
        target = project_root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, target)
        copied.append(str(rel))
    info(f"Copied {len(copied)} files.")


def merge_into_existing(extract_dir: Path, project_root: Path, force: bool) -> None:
    """project_root already has a package.json — merge selectively."""
    print("[3/7] Existing project detected — merging Figma Make export.")

    # 1. Merge package.json dependencies
    merge_package_json(project_root / "package.json", extract_dir / "package.json")

    # 2. Config files — copy only if missing
    for cfg in ["vite.config.ts", "postcss.config.mjs", "index.html"]:
        src = extract_dir / cfg
        dst = project_root / cfg
        if src.exists():
            if copy_file_if_missing(src, dst):
                info(f"Copied (new): {cfg}")
            else:
                info(f"Skipped (exists): {cfg}")

    # 3. src/styles/ — always overwrite (design tokens must match export)
    styles_src = extract_dir / "src" / "styles"
    styles_dst = project_root / "src" / "styles"
    if styles_src.exists():
        shutil.rmtree(styles_dst, ignore_errors=True)
        shutil.copytree(styles_src, styles_dst)
        info("Replaced: src/styles/ (design tokens from export)")

    # 4. src/imports/ — always overwrite (Figma frames)
    imports_src = extract_dir / "src" / "imports"
    imports_dst = project_root / "src" / "imports"
    if imports_src.exists():
        shutil.rmtree(imports_dst, ignore_errors=True)
        shutil.copytree(imports_src, imports_dst)
        frame_count = len(list(imports_src.rglob("*.tsx")))
        info(f"Replaced: src/imports/ ({frame_count} Figma frame(s))")

    # 5. src/app/ — copy missing files; warn about routes.ts if exists
    app_src = extract_dir / "src" / "app"
    app_dst = project_root / "src" / "app"
    if app_src.exists():
        routes_dst = app_dst / "routes.ts"
        if routes_dst.exists() and not force:
            print(
                "  WARNING: src/app/routes.ts already exists and --force was not "
                "passed. Skipping to protect your route configuration."
            )
        copied = copy_tree(app_src, app_dst, force=force)
        if copied:
            info(f"Copied {len(copied)} file(s) into src/app/ (skipped existing).")
        else:
            info("src/app/ — all files already present, nothing copied.")

    # 6. Ancillary root files (README, ATTRIBUTIONS, guidelines)
    for extra in ["README.md", "ATTRIBUTIONS.md"]:
        src = extract_dir / extra
        if src.exists():
            copy_file_if_missing(src, project_root / extra)

    guidelines_src = extract_dir / "guidelines"
    if guidelines_src.exists():
        guidelines_dst = project_root / "guidelines"
        copy_tree(guidelines_src, guidelines_dst, force=force)


# ---------------------------------------------------------------------------
# Install + verify
# ---------------------------------------------------------------------------

DEFAULT_TSCONFIG = """{{
  "compilerOptions": {{
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {{ "@/*": ["./src/*"] }},
    "jsx": "react-jsx"
  }},
  "include": ["src"]
}}
"""


def ensure_typescript(project_root: Path) -> None:
    """
    Figma Make exports do not include TypeScript or a tsconfig.json — Vite uses
    esbuild for transpilation. Add both so tsc-based type-checking and IDE
    support work correctly.
    """
    pkg_path = project_root / "package.json"
    with pkg_path.open() as f:
        pkg = json.load(f)

    added = []
    dev = pkg.setdefault("devDependencies", {})
    for pkg_name, ver in [
        ("typescript", "5"),
        ("@types/react", "18"),
        ("@types/react-dom", "18"),
        ("@types/node", "latest"),
    ]:
        if pkg_name not in dev:
            dev[pkg_name] = ver
            added.append(f"{pkg_name}@{ver}")
    if added:
        with pkg_path.open("w") as f:
            json.dump(pkg, f, indent=2)
            f.write("\n")
        info(f"Added to devDependencies: {', '.join(added)}")

    tsconfig = project_root / "tsconfig.json"
    if not tsconfig.exists():
        tsconfig.write_text(DEFAULT_TSCONFIG)
        info("Created tsconfig.json (Vite bundler-mode, @ alias).")


def detect_package_manager(project_root: Path) -> list[str]:
    if (project_root / "pnpm-lock.yaml").exists():
        return ["pnpm", "install"]
    return ["npm", "install"]


def install_deps(project_root: Path) -> None:
    # Ensure TypeScript is present before installing so it lands in node_modules
    ensure_typescript(project_root)
    cmd = detect_package_manager(project_root)
    print(f"\n[5/7] Installing dependencies: {' '.join(cmd)}")
    try:
        run(cmd, cwd=project_root)
    except subprocess.CalledProcessError:
        die(f"`{' '.join(cmd)}` failed. Check the output above for details.")


def fix_type_errors(project_root: Path) -> None:
    """
    Run fix_figma_type_errors.py to auto-fix known Figma Make code patterns
    (HREF_ON_SPAN, VENDOR_CSS, ORPHAN_REF, ELEMENT_HANDLER) then verify with
    tsc --noEmit. Non-fatal: warns if errors remain after fixing.
    """
    print("\n[6/7] Fixing Figma Make type errors…")
    fixer = Path(__file__).parent / "fix_figma_type_errors.py"
    if not fixer.exists():
        print(f"  SKIP: fixer script not found at {fixer}")
        return
    result = subprocess.run(
        [sys.executable, str(fixer)],
        cwd=project_root,
    )
    if result.returncode != 0:
        print(
            "  NOTE: Some type errors remain — run `npm run dev` to start anyway.\n"
            "  Fix remaining errors before deploying to production."
        )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Integrate a Figma Make ZIP export into a Vite project."
    )
    parser.add_argument(
        "--zip",
        metavar="PATH",
        help="Path to the Figma Make ZIP. Auto-detected if not given.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing src/app/ files (use when re-applying an export).",
    )
    args = parser.parse_args()

    project_root = Path.cwd()
    print(f"Project root: {project_root}")

    # Step 1 — locate ZIP
    zip_path = Path(args.zip) if args.zip else find_zip(project_root)
    if not zip_path.exists():
        die(f"ZIP not found: {zip_path}")
    print(f"Using ZIP: {zip_path}")

    # Step 2 — extract
    extract_dir = extract_zip(zip_path)

    # Validate
    validate_extract(extract_dir)

    # Step 3 — scaffold or merge
    is_fresh = not (project_root / "package.json").exists()
    if is_fresh:
        scaffold_fresh(extract_dir, project_root)
    else:
        merge_into_existing(extract_dir, project_root, force=args.force)

    print(f"\n[4/7] Source files ready.")

    # Step 5 — install
    install_deps(project_root)

    # Step 6 — fix type errors
    fix_type_errors(project_root)

    # Step 7 — report
    print("\n[7/7] Done!")
    print("\nTo start the dev server:")
    cmd = detect_package_manager(project_root)
    print(f"  {'pnpm' if cmd[0] == 'pnpm' else 'npm'} run dev\n")


if __name__ == "__main__":
    main()
