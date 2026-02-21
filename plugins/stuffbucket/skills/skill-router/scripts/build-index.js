#!/usr/bin/env node

// Builds a compact skill index from SKILL.md frontmatter across all plugins.
// Output: index.json in the skill-router directory.
// Usage: node build-index.js [rootDir]

const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || path.join(__dirname, '..', '..', '..', '..', '..');
const OUTPUT = path.join(__dirname, '..', 'index.json');

function parseFrontmatter(content) {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('---', 3);
  if (end === -1) return null;
  const block = content.substring(3, end).trim();

  const fm = {};
  let currentKey = null;
  let inList = false;
  const listItems = [];

  for (const line of block.split('\n')) {
    const listMatch = line.match(/^\s+-\s+(.+)$/);
    if (listMatch && inList && currentKey) {
      listItems.push(listMatch[1].trim());
      continue;
    }

    // Flush previous list
    if (inList && currentKey) {
      fm[currentKey] = listItems.slice();
      listItems.length = 0;
      inList = false;
    }

    const kvMatch = line.match(/^([a-z_-]+)\s*:\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const value = kvMatch[2].trim();
      if (value === '' || value === '[]') {
        // Could be start of a list or empty
        inList = true;
      } else {
        fm[currentKey] = value;
        inList = false;
      }
    }
  }

  // Flush trailing list
  if (inList && currentKey && listItems.length > 0) {
    fm[currentKey] = listItems;
  }

  return fm;
}

function extractTags(fm) {
  // Pull tags from metadata.tags, or infer from name
  if (fm.metadata && typeof fm.metadata === 'object' && fm.metadata.tags) {
    return fm.metadata.tags;
  }
  // Infer from name: "code-analysis-skill" → ["code", "analysis"]
  const name = fm.name || '';
  return name.replace(/-skill$/, '').split('-').filter(Boolean);
}

function discoverSkills(rootDir) {
  const pluginsDir = path.join(rootDir, 'plugins');
  const skills = [];

  if (!fs.existsSync(pluginsDir)) return skills;

  for (const plugin of fs.readdirSync(pluginsDir)) {
    const skillsDir = path.join(pluginsDir, plugin, 'skills');
    if (!fs.existsSync(skillsDir)) continue;

    for (const skill of fs.readdirSync(skillsDir)) {
      const skillPath = path.join(skillsDir, skill);
      const skillMd = path.join(skillPath, 'SKILL.md');

      if (!fs.statSync(skillPath).isDirectory()) continue;
      if (!fs.existsSync(skillMd)) continue;

      // Don't index the router itself
      if (skill === 'skill-router') continue;

      const content = fs.readFileSync(skillMd, 'utf8');
      const fm = parseFrontmatter(content);
      if (!fm || !fm.name || !fm.description) continue;

      const lineCount = content.split('\n').length;

      skills.push({
        name: fm.name,
        description: fm.description,
        path: path.relative(rootDir, skillPath),
        tags: extractTags(fm),
        'allowed-tools': fm['allowed-tools']
          ? (typeof fm['allowed-tools'] === 'string'
              ? fm['allowed-tools'].split(/\s+/)
              : fm['allowed-tools'])
          : [],
        lines: lineCount,
      });
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function buildIndex() {
  const rootDir = path.resolve(ROOT);
  const skills = discoverSkills(rootDir);

  const index = {
    generated: new Date().toISOString(),
    description: 'Compact skill index. Use name/description/tags to match tasks. Load full SKILL.md from path only when needed.',
    count: skills.length,
    skills,
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(index, null, 2) + '\n');

  console.log(`Skill index built: ${skills.length} skills → ${OUTPUT}`);
  for (const s of skills) {
    console.log(`  ${s.name}: ${s.description.substring(0, 80)}...`);
  }
}

buildIndex();
