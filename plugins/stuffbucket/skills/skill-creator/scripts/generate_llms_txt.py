#!/usr/bin/env python3
"""
llms.txt Generator - Assembles llms.txt from repo sources of truth

Usage:
    generate_llms_txt.py [--check] [--stdout]

Reads llms.tmpl.txt and fills {{PLACEHOLDER}} markers with data probed
from SKILL.md frontmatter, script docstrings, .mcp.json, and mcp-server.js.

Options:
    --check   Compare generated output against existing llms.txt, exit 1 if different
    --stdout  Print to stdout instead of writing file
"""

import json
import re
import subprocess
import sys
from difflib import unified_diff
from pathlib import Path


def find_repo_root():
    """Walk up from script location to find repo root."""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / '.github').is_dir():
            return current
        current = current.parent
    return None


def parse_frontmatter(text):
    """Parse YAML frontmatter without pyyaml dependency."""
    match = re.match(r'^---\n(.*?)\n---', text, re.DOTALL)
    if not match:
        return None
    result = {}
    for line in match.group(1).split('\n'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if ':' in line:
            key, _, value = line.partition(':')
            result[key.strip()] = value.strip()
    return result


# --- Probe functions ---


def probe_skills(root):
    """Discover skills from SKILL.md frontmatter."""
    skills = []
    plugins_dir = root / 'plugins'
    if not plugins_dir.is_dir():
        return skills
    for plugin_dir in sorted(plugins_dir.iterdir()):
        skills_dir = plugin_dir / 'skills'
        if not skills_dir.is_dir():
            continue
        for skill_dir in sorted(skills_dir.iterdir()):
            skill_md = skill_dir / 'SKILL.md'
            if not skill_md.is_file():
                continue
            fm = parse_frontmatter(skill_md.read_text())
            if not fm or 'name' not in fm or 'description' not in fm:
                continue
            skills.append({
                'name': fm['name'],
                'description': fm['description'],
                'tools': fm.get('allowed-tools', ''),
                'path': str(skill_dir.relative_to(root)),
            })
    return skills


def probe_scripts(root):
    """Extract summaries and usage from script files in skill directories."""
    scripts = []
    plugins_dir = root / 'plugins'
    if not plugins_dir.is_dir():
        return scripts
    for script_path in sorted(plugins_dir.rglob('scripts/*')):
        if script_path.suffix not in ('.py', '.js'):
            continue
        content = script_path.read_text()
        summary = ''
        usage = ''
        if script_path.suffix == '.py':
            m = re.match(r'(?s)^(?:#![^\n]*\n)?"""(.*?)"""', content)
            if m:
                doc = m.group(1).strip()
                summary = doc.split('\n')[0]
                um = re.search(r'Usage:\s*\n\s+(\S.*)', doc)
                if um:
                    usage = um.group(1).strip()
        elif script_path.suffix == '.js':
            awaiting_usage = False
            for line in content.split('\n'):
                stripped = line.strip()
                if not stripped or stripped.startswith('#!'):
                    continue
                if stripped.startswith('//'):
                    text = stripped.lstrip('/').strip()
                    if not text:
                        continue
                    if text.startswith('Usage:'):
                        utext = text[len('Usage:'):].strip()
                        if utext:
                            usage = utext
                        else:
                            awaiting_usage = True
                    elif awaiting_usage and not usage:
                        # First indented line after bare "Usage:" header
                        usage = text.split('#')[0].strip()
                        awaiting_usage = False
                    elif not summary:
                        summary = text
                else:
                    break
        if summary:
            rel = script_path.relative_to(root)
            parts = rel.parts
            skill_name = parts[3] if len(parts) > 3 else ''
            scripts.append({
                'skill': skill_name,
                'file': script_path.name,
                'summary': summary,
                'usage': usage,
            })
    return scripts


def _extract_quoted(prefix, text):
    """Search for prefix followed by a quoted string, return the content."""
    for q, end_q in [('"', '"'), ("'", "'")]:
        m = re.search(prefix + r'\s*\n?\s*' + q + r'([^' + end_q + r']*)' + q, text)
        if m:
            return m.group(1)
    return ''


def probe_mcp(root):
    """Parse MCP server config and tool definitions from mcp-server.js."""
    mcp_path = root / 'plugins' / 'stuffbucket' / '.mcp.json'
    if not mcp_path.is_file():
        return []
    config = json.loads(mcp_path.read_text())
    servers = config.get('mcpServers', {})
    results = []
    for server_name, server_config in servers.items():
        command = server_config.get('command', '')
        args = server_config.get('args', [])
        cmd_line = ' '.join([command] + args)
        tools = []
        # Resolve the JS file that defines the TOOLS array.
        # Try args as a local path first; fall back to convention:
        # plugins/<plugin>/skills/<server_name>/scripts/mcp-server.js
        js_path = None
        if args:
            candidate = root / args[0]
            if candidate.is_file() and candidate.suffix == '.js':
                js_path = candidate
        if js_path is None:
            candidate = (
                mcp_path.parent / 'skills' / server_name
                / 'scripts' / 'mcp-server.js'
            )
            if candidate.is_file():
                js_path = candidate
        if js_path is not None:
            js_content = js_path.read_text()
            tools_match = re.search(
                r'const TOOLS\s*=\s*\[(.*?)\];', js_content, re.DOTALL
            )
            if tools_match:
                block = tools_match.group(1)
                # Find tool-level names (followed by quoted value, not {)
                name_pat = r'name:\s*(?:"([^"]+)"|\'([^\']+)\')'
                name_positions = []
                for m in re.finditer(name_pat, block):
                    name = m.group(1) if m.group(1) is not None else m.group(2)
                    name_positions.append((m.start(), name))
                for i, (pos, tname) in enumerate(name_positions):
                    end = (
                        name_positions[i + 1][0]
                        if i + 1 < len(name_positions)
                        else len(block)
                    )
                    section = block[pos:end]
                    tdesc = _extract_quoted('description:', section)
                    inputs = []
                    props_m = re.search(
                        r'properties:\s*\{(.*)\}', section, re.DOTALL
                    )
                    if props_m:
                        prop_pat = (
                            r'(\w+):\s*\{[^}]*?'
                            r'type:\s*(?:"(\w+)"|\'(\w+)\')[^}]*?'
                            r'description:\s*\n?\s*'
                            r'(?:"([^"]*)"|\'([^\']*)\')'
                        )
                        for pm in re.finditer(prop_pat, props_m.group(1)):
                            inputs.append({
                                'name': pm.group(1),
                                'type': pm.group(2) or pm.group(3),
                                'description': pm.group(4) if pm.group(4) is not None else pm.group(5),
                            })
                    req_m = re.search(r"required:\s*\[([^\]]*)\]", section)
                    required = []
                    if req_m:
                        required = [
                            r.strip().strip("'\"")
                            for r in req_m.group(1).split(',')
                            if r.strip()
                        ]
                    for inp in inputs:
                        inp['required'] = inp['name'] in required
                    tools.append({
                        'name': tname,
                        'description': tdesc,
                        'inputs': inputs,
                    })
        results.append({
            'server': server_name,
            'command': cmd_line,
            'tools': tools,
        })
    return results


def probe_structure(root):
    """Return static structure descriptions for key repo paths."""
    return [
        ('plugins/<plugin>/skills/<skill>/SKILL.md',
         'skill definitions (YAML frontmatter + markdown)'),
        ('plugins/<plugin>/.mcp.json',
         'canonical MCP server config per plugin'),
        ('.mcp.json',
         'symlink \u2192 plugins/stuffbucket/.mcp.json (root-level MCP discovery)'),
        ('.vscode/mcp.json',
         'symlink \u2192 plugins/stuffbucket/.mcp.json (VS Code MCP discovery)'),
        ('.claude-plugin/marketplace.json',
         'Claude Code plugin discovery (functional)'),
        ('.github/plugin/marketplace.json',
         'Copilot plugin manifest'),
        ('plugins/stuffbucket/skills/skill-router/index.json',
         'generated skill index (npm run build:index)'),
        ('template/',
         'starter template for new skills'),
    ]


def probe_docs(root):
    """Find documentation files and extract first heading as title."""
    docs = []
    for pattern in ['docs/*.md', 'spec/*.md']:
        for p in sorted(root.glob(pattern)):
            title = ''
            for line in p.read_text().split('\n'):
                if line.startswith('# '):
                    title = line[2:].strip()
                    break
            docs.append({
                'path': str(p.relative_to(root)),
                'title': title or p.stem,
            })
    return docs


def probe_health(root):
    """Run validators to check repo health (deterministic, based on committed files)."""
    results = {'skills': [], 'schemas': None}
    validate_script = (
        root / 'plugins' / 'stuffbucket' / 'skills'
        / 'skill-creator' / 'scripts' / 'quick_validate.py'
    )
    schema_script = (
        root / 'plugins' / 'stuffbucket' / 'skills'
        / 'skill-creator' / 'scripts' / 'validate_schemas.py'
    )
    # Validate each skill
    plugins_dir = root / 'plugins'
    if plugins_dir.is_dir():
        for plugin_dir in sorted(plugins_dir.iterdir()):
            if not plugin_dir.is_dir():
                continue
            skills_dir = plugin_dir / 'skills'
            if not skills_dir.is_dir():
                continue
            for skill_dir in sorted(skills_dir.iterdir()):
                if not skill_dir.is_dir():
                    continue
                if not (skill_dir / 'SKILL.md').is_file():
                    continue
                if validate_script.is_file():
                    try:
                        r = subprocess.run(
                            [sys.executable, str(validate_script), str(skill_dir)],
                            capture_output=True, text=True, timeout=10,
                        )
                        results['skills'].append({
                            'name': skill_dir.name,
                            'passed': r.returncode == 0,
                            'message': r.stdout.strip(),
                        })
                    except Exception as e:
                        results['skills'].append({
                            'name': skill_dir.name,
                            'passed': False,
                            'message': str(e),
                        })
    # Validate schemas
    if schema_script.is_file():
        try:
            r = subprocess.run(
                [sys.executable, str(schema_script), str(root)],
                capture_output=True, text=True, timeout=10,
            )
            results['schemas'] = {
                'passed': r.returncode == 0,
                'output': r.stdout.strip(),
            }
        except Exception as e:
            results['schemas'] = {'passed': False, 'output': str(e)}
    return results


def probe_quick_start(root):
    """Extract npm scripts from package.json."""
    pkg_path = root / 'package.json'
    if pkg_path.is_file():
        return json.loads(pkg_path.read_text()).get('scripts', {})
    return {}


# --- Formatters ---


def format_quick_start(scripts):
    script_docs = {
        'setup': 'create MCP symlinks + build skill index',
        'build:index': 'rebuild skill index only',
        'build:llms': 'regenerate llms.txt from template',
        'lint': 'run all linters (markdown, JS, JSON schemas)',
        'validate': 'validate example skill frontmatter',
        'test': 'lint + validate + build index',
    }
    lines = []
    for name, desc in script_docs.items():
        if name in scripts:
            lines.append(f'  npm run {name:<14s} # {desc}')
    return '\n'.join(lines)


def format_health(data):
    lines = ['Skill validation:']
    for s in data['skills']:
        mark = '\u2713' if s['passed'] else '\u2717'
        lines.append(f'  {mark} {s["name"]}')
        if not s['passed']:
            lines.append(f'    {s["message"]}')
    if data['schemas']:
        lines.append('')
        for line in data['schemas']['output'].split('\n'):
            line = line.strip()
            if line.startswith('PASS') or line.startswith('FAIL'):
                lines.append(f'  {line}')
            elif line.startswith('All ') or line == 'Validation failed.':
                lines.append('')
                lines.append(f'Schema validation: {line}')
    return '\n'.join(lines)


def format_skills(skills):
    if not skills:
        return 'No skills found.'
    lines = ['| Skill | Description | Allowed Tools |', '|---|---|---|']
    for s in skills:
        tools = ', '.join(s['tools'].split()) if s['tools'] else '\u2014'
        desc = s['description'].replace('|', '\\|')
        if len(desc) > 80:
            desc = desc[:77] + '...'
        lines.append(f'| {s["name"]} | {desc} | {tools} |')
    return '\n'.join(lines)


def format_commands(scripts):
    if not scripts:
        return 'No scripts found.'
    by_skill = {}
    for s in scripts:
        by_skill.setdefault(s['skill'], []).append(s)
    lines = []
    for skill, items in sorted(by_skill.items()):
        lines.append(f'**{skill}:**')
        for item in items:
            usage = item['usage'] or item['file']
            lines.append(f'- `{usage}` \u2014 {item["summary"]}')
        lines.append('')
    return '\n'.join(lines).rstrip()


def format_mcp(mcp_data):
    if not mcp_data:
        return 'No MCP configuration found.'
    lines = []
    for server in mcp_data:
        lines.append(f'Server: `{server["server"]}`')
        lines.append(f'Command: `{server["command"]}`')
        lines.append('')
        lines.append('Tools:')
        for tool in server['tools']:
            lines.append(f'- `{tool["name"]}` \u2014 {tool["description"]}')
            for inp in tool.get('inputs', []):
                req = 'required' if inp.get('required') else 'optional'
                lines.append(
                    f'  - `{inp["name"]}` ({inp["type"]}, {req})'
                    f' \u2014 {inp["description"]}'
                )
    return '\n'.join(lines)


def format_structure(items):
    return '\n'.join(f'- `{path}` \u2014 {note}' for path, note in items)


def format_docs(docs):
    return '\n'.join(f'- `{d["path"]}` \u2014 {d["title"]}' for d in docs)


# --- Main ---


def generate(root):
    """Generate llms.txt content from template and probes."""
    template_path = root / 'llms.tmpl.txt'
    if not template_path.is_file():
        print(f'Error: Template not found: {template_path}', file=sys.stderr)
        sys.exit(1)
    template = template_path.read_text()
    placeholders = {
        'QUICK_START': format_quick_start(probe_quick_start(root)),
        'HEALTH': format_health(probe_health(root)),
        'SKILLS': format_skills(probe_skills(root)),
        'COMMANDS': format_commands(probe_scripts(root)),
        'MCP': format_mcp(probe_mcp(root)),
        'STRUCTURE': format_structure(probe_structure(root)),
        'DOCS': format_docs(probe_docs(root)),
    }
    result = template
    for key, value in placeholders.items():
        result = result.replace(f'{{{{{key}}}}}', value)
    return result


def main():
    root = find_repo_root()
    if not root:
        print('Error: Could not find repository root', file=sys.stderr)
        sys.exit(1)
    content = generate(root)
    if '--check' in sys.argv:
        llms_path = root / 'llms.txt'
        if not llms_path.is_file():
            print('llms.txt does not exist \u2014 run without --check to generate')
            sys.exit(1)
        existing = llms_path.read_text()
        if existing == content:
            print('llms.txt is up to date.')
            sys.exit(0)
        else:
            diff = unified_diff(
                existing.splitlines(keepends=True),
                content.splitlines(keepends=True),
                fromfile='llms.txt (committed)',
                tofile='llms.txt (generated)',
            )
            sys.stdout.writelines(diff)
            print('\nllms.txt is out of date \u2014 regenerate with:')
            print(f'  python3 {Path(__file__).relative_to(root)}')
            sys.exit(1)
    elif '--stdout' in sys.argv:
        print(content, end='')
    else:
        llms_path = root / 'llms.txt'
        llms_path.write_text(content)
        print(f'Generated {llms_path}')


if __name__ == '__main__':
    main()
