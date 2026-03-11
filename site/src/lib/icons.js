// Shared icon data — used by sync-skills.js (build time) and Astro pages (render time).
// All paths use a 24×24 viewBox, Lucide-style stroke icons.

export const ICON_PATHS = {
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  'git-branch': '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 4 0 4 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-4 0-4"/>',
  'pen-tool': '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  lightbulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>',
  sparkles: '<path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  package: '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
};

// Keyword → icon resolution rules (ordered by specificity)
const ICON_RULES = [
  { icon: 'pen-tool', keywords: ['figma', 'design', 'css', 'component', 'prototype'] },
  { icon: 'rocket', keywords: ['deploy', 'deployment', 'pages', 'publish', 'pipeline', 'ci', 'cd'] },
  { icon: 'code', keywords: ['code', 'analysis', 'lint', 'refactor', 'debug', 'review'] },
  { icon: 'folder', keywords: ['file', 'management', 'directory', 'folder'] },
  { icon: 'git-branch', keywords: ['git', 'commit', 'branch', 'merge', 'rebase'] },
  { icon: 'check-circle', keywords: ['test', 'testing', 'spec', 'assert', 'coverage'] },
  { icon: 'sparkles', keywords: ['create', 'creator', 'generate', 'scaffold', 'init'] },
  { icon: 'lightbulb', keywords: ['example', 'template', 'demo', 'tutorial', 'guide'] },
  { icon: 'shield', keywords: ['security', 'auth', 'encrypt', 'protect'] },
  { icon: 'database', keywords: ['data', 'database', 'sql', 'storage'] },
  { icon: 'globe', keywords: ['api', 'http', 'rest', 'network', 'fetch'] },
];

/** Resolve the best icon for a skill based on name, tags, and description. */
export function resolveIcon(name, tags = [], description = '') {
  const text = [name, ...tags, description.substring(0, 200)].join(' ').toLowerCase();
  for (const rule of ICON_RULES) {
    if (rule.keywords.some(kw => new RegExp(`\\b${kw}\\b`).test(text))) {
      return rule.icon;
    }
  }
  return 'package';
}

/** Build an SVG string from an icon name. */
export function iconSvg(name, size = 24) {
  const paths = ICON_PATHS[name] || ICON_PATHS.package;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}
