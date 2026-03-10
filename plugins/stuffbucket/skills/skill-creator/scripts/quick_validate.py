#!/usr/bin/env python3
"""
Quick validation script for skills - minimal version
"""

import sys
import re
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None


def parse_frontmatter(text):
    """Parse YAML frontmatter without pyyaml dependency."""
    match = re.match(r'^---\n(.*?)\n---', text, re.DOTALL)
    if not match:
        return None
    raw = match.group(1)
    result = {}
    for line in raw.split('\n'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if ':' in line:
            key, _, value = line.partition(':')
            result[key.strip()] = value.strip()
    return result


def validate_skill(skill_path):
    """Basic validation of a skill."""
    skill_path = Path(skill_path)

    skill_md = skill_path / 'SKILL.md'
    if not skill_md.exists():
        return False, "SKILL.md not found"

    content = skill_md.read_text()
    if not content.startswith('---'):
        return False, "No YAML frontmatter found"

    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return False, "Invalid frontmatter format"

    frontmatter_text = match.group(1)

    if yaml:
        try:
            frontmatter = yaml.safe_load(frontmatter_text)
            if not isinstance(frontmatter, dict):
                return False, "Frontmatter must be a YAML dictionary"
        except yaml.YAMLError as e:
            return False, f"Invalid YAML in frontmatter: {e}"
    else:
        frontmatter = parse_frontmatter(content)
        if frontmatter is None:
            return False, "Invalid frontmatter format"

    ALLOWED_PROPERTIES = {'name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility'}

    unexpected_keys = set(frontmatter.keys()) - ALLOWED_PROPERTIES
    if unexpected_keys:
        return False, (
            f"Unexpected key(s) in SKILL.md frontmatter: {', '.join(sorted(unexpected_keys))}. "
            f"Allowed properties are: {', '.join(sorted(ALLOWED_PROPERTIES))}"
        )

    if 'name' not in frontmatter:
        return False, "Missing 'name' in frontmatter"
    if 'description' not in frontmatter:
        return False, "Missing 'description' in frontmatter"

    name = frontmatter.get('name', '')
    if not isinstance(name, str):
        return False, f"Name must be a string, got {type(name).__name__}"
    name = name.strip()
    if name:
        if not re.match(r'^[a-z0-9-]+$', name):
            return False, f"Name '{name}' should be kebab-case (lowercase letters, digits, and hyphens only)"
        if name.startswith('-') or name.endswith('-') or '--' in name:
            return False, f"Name '{name}' cannot start/end with hyphen or contain consecutive hyphens"
        if len(name) > 64:
            return False, f"Name is too long ({len(name)} characters). Maximum is 64 characters."

    description = frontmatter.get('description', '')
    if not isinstance(description, str):
        return False, f"Description must be a string, got {type(description).__name__}"
    description = description.strip()
    if description:
        if '<' in description or '>' in description:
            return False, "Description cannot contain angle brackets (< or >)"
        if len(description) > 1024:
            return False, f"Description is too long ({len(description)} characters). Maximum is 1024 characters."

    compatibility = frontmatter.get('compatibility', '')
    if compatibility:
        if not isinstance(compatibility, str):
            return False, f"Compatibility must be a string, got {type(compatibility).__name__}"
        if len(compatibility) > 500:
            return False, f"Compatibility is too long ({len(compatibility)} characters). Maximum is 500 characters."

    # ── Content completeness checks ──

    # Detect leftover TODO markers from the init template
    body = content[match.end():]  # text after frontmatter
    todo_lines = [
        i + 1 for i, line in enumerate(body.splitlines())
        if re.search(r'\[TODO\b', line)
    ]
    if todo_lines:
        return False, f"Unfinished [TODO] markers on line(s) {', '.join(str(n) for n in todo_lines[:5])} (relative to body)"

    # Detect leftover description placeholder in frontmatter
    if description.startswith('[TODO'):
        return False, "Frontmatter description is still a placeholder"

    # ── Placeholder file detection ──

    PLACEHOLDER_SIGNATURES = [
        'This is a placeholder script',
        'This is a placeholder for detailed reference documentation',
        'This placeholder represents where asset files would be stored',
    ]

    for subdir in ('scripts', 'references', 'assets'):
        sub_path = skill_path / subdir
        if not sub_path.is_dir():
            continue
        for f in sub_path.iterdir():
            if not f.is_file():
                continue
            try:
                file_text = f.read_text(errors='ignore')[:2048]
            except OSError:
                continue
            for sig in PLACEHOLDER_SIGNATURES:
                if sig in file_text:
                    return False, f"Placeholder file not replaced: {subdir}/{f.name}"

    # ── Script presence check ──
    # If SKILL.md references scripts/<file> in a run/execution context, verify
    # the file exists. Skip fenced code blocks, inline backtick spans, and
    # illustrative examples.

    in_fence = False
    for line in body.splitlines():
        # Track fenced code blocks
        if line.strip().startswith('```'):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        # Skip lines that are illustrative examples, not actual references
        if re.search(r'\bexample\b|e\.g\.|for instance', line, re.IGNORECASE):
            continue
        # Strip inline backtick spans before matching
        stripped = re.sub(r'`[^`]+`', '', line)
        for ref_match in re.finditer(r'scripts/([A-Za-z0-9_.-]+)', stripped):
            script_name = ref_match.group(1)
            script_file = skill_path / 'scripts' / script_name
            if not script_file.exists():
                return False, f"SKILL.md references scripts/{script_name} but the file does not exist"

    return True, "Skill is valid!"


def validate_all_skills(skills_root):
    """Validate every skill under a root directory (each subdirectory with a SKILL.md)."""
    root = Path(skills_root)
    if not root.is_dir():
        print(f"Error: {skills_root} is not a directory")
        return False

    skill_dirs = sorted(
        d for d in root.iterdir()
        if d.is_dir() and (d / 'SKILL.md').exists()
    )

    if not skill_dirs:
        print(f"No skills found under {skills_root}")
        return False

    all_valid = True
    for skill_dir in skill_dirs:
        valid, message = validate_skill(skill_dir)
        status = "PASS" if valid else "FAIL"
        print(f"  [{status}] {skill_dir.name}: {message}")
        if not valid:
            all_valid = False

    print()
    print(f"Validated {len(skill_dirs)} skill(s): {'all passed' if all_valid else 'some failed'}")
    return all_valid


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == '--all':
        success = validate_all_skills(sys.argv[2])
        sys.exit(0 if success else 1)
    elif len(sys.argv) == 2:
        valid, message = validate_skill(sys.argv[1])
        print(message)
        sys.exit(0 if valid else 1)
    else:
        print("Usage:")
        print("  python quick_validate.py <skill_directory>        # validate one skill")
        print("  python quick_validate.py --all <skills_root>      # validate all skills")
        sys.exit(1)
