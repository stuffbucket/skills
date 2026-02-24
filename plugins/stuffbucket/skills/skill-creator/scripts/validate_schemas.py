#!/usr/bin/env python3
"""
JSON Schema Validator - Validates marketplace.json and .mcp.json files against schemas

Auto-discovers:
  - .github/plugin/marketplace.json
  - .claude-plugin/marketplace.json
  - All .mcp.json files under plugins/

Usage:
    validate_schemas.py [repo-root]

If repo-root is not provided, walks up from the script location to find the
repository root (identified by the presence of a .github or .claude-plugin directory).
"""

import json
import sys
import re
from pathlib import Path


def find_repo_root(start=None):
    """Walk up from start to find the repository root."""
    current = Path(start).resolve() if start else Path(__file__).resolve().parent
    while current != current.parent:
        if (current / '.git').is_dir():
            return current
        current = current.parent
    return None


def validate_type(value, schema, path="$"):
    """Validate a value against a JSON Schema (subset implementation).

    Supports: type, required, properties, additionalProperties,
    minLength, minItems, minProperties, pattern, items, enum, oneOf.
    """
    errors = []

    if "oneOf" in schema:
        matches = []
        for i, sub in enumerate(schema["oneOf"]):
            sub_errors = validate_type(value, sub, path)
            if not sub_errors:
                matches.append(i)
        if len(matches) != 1:
            errors.append(f"{path}: must match exactly one of oneOf (matched {len(matches)})")
        return errors

    if "type" in schema:
        expected = schema["type"]
        type_map = {
            "string": str,
            "number": (int, float),
            "integer": int,
            "boolean": bool,
            "array": list,
            "object": dict,
        }
        if expected in type_map:
            if not isinstance(value, type_map[expected]):
                errors.append(f"{path}: expected type '{expected}', got '{type(value).__name__}'")
                return errors

    if "enum" in schema:
        if value not in schema["enum"]:
            errors.append(f"{path}: value must be one of {schema['enum']}")

    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            errors.append(f"{path}: string too short (min {schema['minLength']})")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errors.append(f"{path}: does not match pattern '{schema['pattern']}'")

    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.append(f"{path}: array has {len(value)} items, minimum is {schema['minItems']}")
        if "items" in schema:
            for i, item in enumerate(value):
                errors.extend(validate_type(item, schema["items"], f"{path}[{i}]"))

    if isinstance(value, dict):
        if "minProperties" in schema and len(value) < schema["minProperties"]:
            errors.append(f"{path}: object has {len(value)} properties, minimum is {schema['minProperties']}")

        if "required" in schema:
            for key in schema["required"]:
                if key not in value:
                    errors.append(f"{path}: missing required property '{key}'")

        props = schema.get("properties", {})
        additional = schema.get("additionalProperties", True)

        for key, val in value.items():
            if key in props:
                errors.extend(validate_type(val, props[key], f"{path}.{key}"))
            elif additional is False:
                errors.append(f"{path}: unexpected property '{key}'")
            elif isinstance(additional, dict):
                errors.extend(validate_type(val, additional, f"{path}.{key}"))

    return errors


def validate_file(json_path, schema):
    """Validate a JSON file against a schema. Returns (valid, errors)."""
    try:
        data = json.loads(json_path.read_text())
    except json.JSONDecodeError as e:
        return False, [f"Invalid JSON: {e}"]
    except Exception as e:
        return False, [f"Cannot read file: {e}"]

    errors = validate_type(data, schema)
    return len(errors) == 0, errors


def discover_files(repo_root):
    """Discover marketplace.json and .mcp.json files with their schemas.

    For marketplace.json files, the schema is resolved by:
      1. Reading the $schema URL from the JSON file
      2. Looking for a matching schema file in the same directory
         (e.g., marketplace.schema.json)
    For .mcp.json files, the schema is loaded from the skill-creator references.
    """
    targets = []

    marketplace_locations = [
        repo_root / '.github' / 'plugin' / 'marketplace.json',
        repo_root / '.claude-plugin' / 'marketplace.json',
    ]
    for loc in marketplace_locations:
        if loc.exists():
            schema_path = loc.parent / 'marketplace.schema.json'
            if schema_path.exists():
                targets.append(('marketplace', loc, schema_path))
            else:
                print(f"  SKIP  {loc.relative_to(repo_root)} — no co-located schema")

    plugins_dir = repo_root / 'plugins'
    if plugins_dir.is_dir():
        for mcp_file in plugins_dir.rglob('.mcp.json'):
            targets.append(('mcp', mcp_file, None))

    return targets


def main():
    repo_root = None
    if len(sys.argv) > 1:
        repo_root = Path(sys.argv[1]).resolve()
    else:
        repo_root = find_repo_root()

    if not repo_root:
        print("Error: Could not determine repository root.")
        print("Usage: validate_schemas.py [repo-root]")
        sys.exit(1)

    # Load MCP schema from references/ directory next to this script
    script_dir = Path(__file__).resolve().parent
    references_dir = script_dir.parent / 'references'

    mcp_schema_path = references_dir / 'mcp.schema.json'
    if not mcp_schema_path.exists():
        print(f"Error: MCP schema not found: {mcp_schema_path}")
        sys.exit(1)
    mcp_schema = json.loads(mcp_schema_path.read_text())

    targets = discover_files(repo_root)
    if not targets:
        print("No files found to validate.")
        sys.exit(0)

    print(f"Validating JSON schemas in {repo_root}\n")

    all_valid = True
    for schema_type, file_path, schema_path in targets:
        rel_path = file_path.relative_to(repo_root)
        if schema_type == 'marketplace':
            schema = json.loads(schema_path.read_text())
        else:
            schema = mcp_schema
        valid, errors = validate_file(file_path, schema)

        if valid:
            print(f"  PASS  {rel_path}")
        else:
            all_valid = False
            print(f"  FAIL  {rel_path}")
            for err in errors:
                print(f"        {err}")

    print()
    if all_valid:
        print(f"All {len(targets)} file(s) valid.")
    else:
        print("Validation failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
