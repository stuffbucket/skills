#!/usr/bin/env node

// Copies SKILL.md files from the repo into site/src/content/skills/
// and doc files from docs/ and spec/ into site/src/content/docs/
// so Astro content collections can render them as pages.
//
// Also writes site/public/skill-index.json for client-side search.
//
// What this does NOT do: infer, summarise, or generate any content.
// It reads the source files and normalises the frontmatter for Astro.
// Adding a skill to the repo is all that's needed for a new page.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { resolveIcon, ICON_PATHS } from '../src/lib/icons.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const PLUGINS_DIR = join(REPO_ROOT, 'plugins');
const SKILLS_OUT = join(__dirname, '..', 'src', 'content', 'skills');
const DOCS_OUT = join(__dirname, '..', 'src', 'content', 'docs');
const PUBLIC_DIR = join(__dirname, '..', 'public');

function parseFrontmatter(content) {
  if (!content.startsWith('---')) return { fm: {}, body: content };
  const end = content.indexOf('---', 3);
  if (end === -1) return { fm: {}, body: content };

  const block = content.substring(3, end).trim();
  const body = content.substring(end + 3).trim();

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
        inList = true;
      } else {
        fm[currentKey] = value;
        inList = false;
      }
    }
  }
  if (inList && currentKey && listItems.length > 0) {
    fm[currentKey] = listItems;
  }

  return { fm, body };
}

function discoverSkills() {
  const skills = [];

  for (const plugin of readdirSync(PLUGINS_DIR)) {
    const skillsDir = join(PLUGINS_DIR, plugin, 'skills');
    if (!existsSync(skillsDir)) continue;

    for (const skill of readdirSync(skillsDir)) {
      const skillDir = join(skillsDir, skill);
      const skillMd = join(skillDir, 'SKILL.md');

      if (!statSync(skillDir).isDirectory()) continue;
      if (!existsSync(skillMd)) continue;
      if (skill === 'skill-router') continue; // infrastructure, not a user-facing skill

      const content = readFileSync(skillMd, 'utf8');
      const { fm, body } = parseFrontmatter(content);

      if (!fm.name || !fm.description) continue;

      const hasScripts = existsSync(join(skillDir, 'scripts'));
      const hasReferences = existsSync(join(skillDir, 'references'));
      const hasAssets = existsSync(join(skillDir, 'assets'));
      const repoPath = relative(REPO_ROOT, skillDir);

      let scriptCount = 0;
      if (hasScripts) {
        scriptCount = readdirSync(join(skillDir, 'scripts'))
          .filter(f => !f.startsWith('__') && !f.startsWith('.') && !f.endsWith('.pyc'))
          .length;
      }

      const tags = fm.name.replace(/-skill$/, '').split('-').filter(Boolean);

      // Semantic tag enrichment: pull notable terms from the description
      const TERM_RE = /\b(github|vite|react|typescript|figma|python|jest|vitest|pytest|deployment|ci|api|pr|workflow)\b/gi;
      for (const m of fm.description.matchAll(TERM_RE)) {
        const term = m[0].toLowerCase();
        if (!tags.includes(term)) tags.push(term);
      }

      const icon = resolveIcon(fm.name, tags, fm.description);

      skills.push({
        slug: fm.name,
        name: fm.name,
        description: fm.description,
        license: fm.license || null,
        allowedTools: fm['allowed-tools']
          ? (typeof fm['allowed-tools'] === 'string'
              ? fm['allowed-tools'].split(/\s+/)
              : fm['allowed-tools'])
          : [],
        repoPath,
        hasScripts,
        hasReferences,
        hasAssets,
        scriptCount,
        tags,
        icon,
        body,
      });
    }
  }

  // ── Pipeline detection ──────────────────────────────────────
  // Skills sharing a common first and last slug segment with 3+
  // members are treated as ordered pipeline stages.
  const STAGE_ORDER = ['prepare', 'build', 'commit', 'push', 'publish'];
  const groups = {};
  for (const s of skills) {
    const parts = s.slug.split('-');
    if (parts.length < 3) continue;
    const key = parts[0];
    (groups[key] ??= []).push(s);
  }
  for (const members of Object.values(groups)) {
    if (members.length < 3) continue;
    const suffix = members[0].slug.split('-').at(-1);
    if (!members.every(m => m.slug.endsWith(`-${suffix}`))) continue;
    const prefix = members[0].slug.split('-')[0];
    const pid = `${prefix}-${suffix}`;
    for (const m of members) {
      const stage = m.slug.replace(new RegExp(`^${prefix}-`), '').replace(new RegExp(`-${suffix}$`), '');
      m.pipeline = pid;
      m.pipelineStage = stage;
      m.pipelineOrder = STAGE_ORDER.indexOf(stage);
      if (m.pipelineOrder === -1) m.pipelineOrder = 99;
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function writeSkillFile(skill) {
  const frontmatter = [
    '---',
    `name: "${skill.name}"`,
    `description: "${skill.description.replace(/"/g, '\\"')}"`,
    `skillSlug: "${skill.slug}"`,
    skill.license ? `license: "${skill.license}"` : null,
    `repoPath: "${skill.repoPath}"`,
    `icon: "${skill.icon}"`,
    `hasScripts: ${skill.hasScripts}`,
    `hasReferences: ${skill.hasReferences}`,
    `hasAssets: ${skill.hasAssets}`,
    `scriptCount: ${skill.scriptCount}`,
    skill.tags.length > 0
      ? `tags:\n${skill.tags.map(t => `  - "${t}"`).join('\n')}`
      : 'tags: []',
    skill.allowedTools.length > 0
      ? `allowedTools:\n${skill.allowedTools.map(t => `  - "${t}"`).join('\n')}`
      : 'allowedTools: []',
    skill.pipeline ? `pipeline: "${skill.pipeline}"` : null,
    skill.pipelineStage ? `pipelineStage: "${skill.pipelineStage}"` : null,
    skill.pipelineOrder != null && skill.pipeline ? `pipelineOrder: ${skill.pipelineOrder}` : null,
    '---',
  ].filter(Boolean).join('\n');

  const content = `${frontmatter}\n\n${skill.body}\n`;
  const outPath = join(SKILLS_OUT, `${skill.slug}.md`);
  writeFileSync(outPath, content, 'utf8');
}

function writeSkillIndex(skills) {
  const index = skills.map(s => ({
    name: s.name,
    description: s.description,
    slug: s.slug,
    tags: s.tags,
    icon: s.icon,
    iconPath: ICON_PATHS[s.icon] || ICON_PATHS.package,
    scriptCount: s.scriptCount,
    hasReferences: s.hasReferences,
    hasAssets: s.hasAssets,
    toolCount: s.allowedTools.length,
    ...(s.pipeline ? { pipeline: s.pipeline, pipelineStage: s.pipelineStage } : {}),
  }));
  writeFileSync(join(PUBLIC_DIR, 'skill-index.json'), JSON.stringify(index), 'utf8');
}

// ── Docs sync ──────────────────────────────────────────────────

const DOC_SOURCES = [
  { file: 'docs/best-practices.md', slug: 'best-practices', icon: 'lightbulb', order: 1 },
  { file: 'docs/contributing.md', slug: 'contributing', icon: 'git-branch', order: 2 },
  { file: 'docs/integration-status.md', slug: 'integration-status', icon: 'check-circle', order: 3 },
  { file: 'spec/agent-skills-spec.md', slug: 'agent-skills-spec', icon: 'file-text', order: 4 },
];

function discoverDocs() {
  const docs = [];
  for (const src of DOC_SOURCES) {
    const filePath = join(REPO_ROOT, src.file);
    if (!existsSync(filePath)) continue;
    const content = readFileSync(filePath, 'utf8');
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : src.slug;
    const body = content.replace(/^#\s+.+\n+/, '').trim();
    docs.push({ slug: src.slug, title, icon: src.icon, order: src.order, sourcePath: src.file, body });
  }
  return docs.sort((a, b) => a.order - b.order);
}

function writeDocFile(doc) {
  const frontmatter = [
    '---',
    `title: "${doc.title.replace(/"/g, '\\"')}"`,
    `docSlug: "${doc.slug}"`,
    `icon: "${doc.icon}"`,
    `order: ${doc.order}`,
    `sourcePath: "${doc.sourcePath}"`,
    '---',
  ].join('\n');
  writeFileSync(join(DOCS_OUT, `${doc.slug}.md`), `${frontmatter}\n\n${doc.body}\n`, 'utf8');
}

// ── Main ───────────────────────────────────────────────────────

function cleanDir(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
}

cleanDir(SKILLS_OUT);
cleanDir(DOCS_OUT);

const skills = discoverSkills();
for (const skill of skills) writeSkillFile(skill);
writeSkillIndex(skills);

const docs = discoverDocs();
for (const doc of docs) writeDocFile(doc);

console.log(`synced ${skills.length} skills + ${docs.length} docs → site/src/content/`);
