#!/usr/bin/env node

// Builds a pre-computed semantic search index at build time.
//
// Uses sentence-transformer embeddings (all-MiniLM-L6-v2) to compute
// cosine similarity between vocabulary terms and skill descriptions.
// The output is a compact JSON lookup: { term: [[slug, score], ...] }
//
// At query time the browser just loads this file and does object lookups —
// no model, no WASM, no network calls.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const INDEX_PATH = join(PUBLIC_DIR, 'skill-index.json');
const OUTPUT_PATH = join(PUBLIC_DIR, 'semantic-index.json');

// Also output to the skill-router so the MCP server gets semantic search
const ROUTER_OUTPUT = join(
  __dirname, '..', '..', 'plugins', 'stuffbucket', 'skills',
  'skill-router', 'semantic-index.json',
);

// Developer terms beyond what appears in skill content.
// The model captures semantic relationships — "ship" scores high against
// skills whose descriptions mention "deploy / publish / push".
const EXTRA_TERMS = [
  // deployment
  'deploy', 'ship', 'publish', 'host', 'release', 'launch', 'serve', 'live', 'production',
  // testing
  'test', 'spec', 'coverage', 'assert', 'mock', 'fixture', 'unit', 'integration', 'e2e',
  // quality
  'lint', 'review', 'refactor', 'quality', 'clean', 'improve', 'analyze', 'smell',
  // git
  'branch', 'merge', 'rebase', 'stash', 'diff', 'blame', 'tag', 'cherry', 'squash',
  // design / ui
  'design', 'prototype', 'layout', 'component', 'ui', 'ux', 'style', 'css', 'theme',
  // scaffolding
  'create', 'scaffold', 'template', 'init', 'bootstrap', 'setup', 'generate', 'new',
  // file ops
  'read', 'write', 'copy', 'move', 'delete', 'rename', 'find', 'search', 'directory',
  // debugging
  'debug', 'fix', 'patch', 'error', 'bug', 'issue', 'trace', 'breakpoint',
  // devops
  'ci', 'cd', 'pipeline', 'automation', 'actions', 'workflow', 'continuous',
  // scm
  'github', 'git', 'repo', 'repository', 'remote', 'origin', 'clone', 'fork', 'pr',
  // packages
  'npm', 'pnpm', 'yarn', 'package', 'dependency', 'install', 'module',
  // build
  'build', 'compile', 'bundle', 'transpile', 'minify', 'optimize', 'dist',
  // runtime
  'run', 'execute', 'start', 'dev', 'server',
  // frameworks
  'react', 'vue', 'svelte', 'astro', 'vite', 'webpack', 'next',
  // languages
  'typescript', 'javascript', 'python', 'node', 'deno', 'bun',
  // infra
  'docker', 'container', 'kubernetes', 'cloud', 'aws',
  // docs
  'document', 'readme', 'guide', 'tutorial', 'docs',
  // agent
  'skill', 'agent', 'copilot', 'assistant', 'prompt',
];

function cosineSim(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embed(extractor, texts) {
  if (typeof texts === 'string') texts = [texts];
  const output = await extractor(texts, { pooling: 'mean', normalize: true });
  const dim = output.dims[output.dims.length - 1];
  const result = [];
  for (let i = 0; i < texts.length; i++) {
    result.push(Array.from(output.data.slice(i * dim, (i + 1) * dim)));
  }
  return result;
}

async function main() {
  if (!existsSync(INDEX_PATH)) {
    console.log('skill-index.json not found — run sync first');
    return;
  }

  let pipelineFn;
  try {
    const mod = await import('@huggingface/transformers');
    pipelineFn = mod.pipeline;
  } catch {
    console.log('⚠ @huggingface/transformers not available — skipping semantic index');
    return;
  }

  console.log('loading embedding model…');
  const extractor = await pipelineFn(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
  );

  const skills = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));

  // ── Skill embeddings ────────────────────────────────────────
  console.log(`embedding ${skills.length} skills…`);
  const skillTexts = skills.map(s =>
    [s.name, s.description, s.tags.join(' ')].join(' ')
  );
  const skillVecs = [];
  for (const text of skillTexts) {
    const [vec] = await embed(extractor, text);
    skillVecs.push(vec);
  }

  // ── Vocabulary ──────────────────────────────────────────────
  const vocabSet = new Set();
  const allText = skillTexts.join(' ').toLowerCase();
  for (const m of allText.matchAll(/\b[a-z][a-z0-9]{1,}\b/g)) {
    vocabSet.add(m[0]);
  }
  for (const t of EXTRA_TERMS) vocabSet.add(t);
  const vocab = [...vocabSet].sort();

  // ── Term embeddings (batched) ───────────────────────────────
  console.log(`embedding ${vocab.length} vocabulary terms…`);
  const BATCH = 64;
  const termVecs = {};
  for (let i = 0; i < vocab.length; i += BATCH) {
    const batch = vocab.slice(i, i + BATCH);
    const batchVecs = await embed(extractor, batch);
    for (let j = 0; j < batch.length; j++) {
      termVecs[batch[j]] = batchVecs[j];
    }
  }

  // ── Semantic index: term → [[slug, score], …] ──────────────
  const THRESHOLD = 0.3;
  const semanticIndex = {};

  for (const term of vocab) {
    const tv = termVecs[term];
    const matches = [];
    for (let i = 0; i < skills.length; i++) {
      const score = cosineSim(tv, skillVecs[i]);
      if (score >= THRESHOLD) {
        matches.push([skills[i].slug, Math.round(score * 100) / 100]);
      }
    }
    if (matches.length > 0) {
      matches.sort((a, b) => b[1] - a[1]);
      semanticIndex[term] = matches;
    }
  }

  const indexJson = JSON.stringify(semanticIndex);
  writeFileSync(OUTPUT_PATH, indexJson, 'utf8');
  writeFileSync(ROUTER_OUTPUT, indexJson, 'utf8');

  const sizeKB = Math.round(indexJson.length / 1024);
  const termCount = Object.keys(semanticIndex).length;
  console.log(
    `semantic index: ${vocab.length} terms, ${termCount} with matches, ${sizeKB} KB`
  );
}

main().catch(err => {
  console.error('⚠ semantic index build failed:', err.message);
  // Don't fail the overall build — catalog falls back to Fuse.js
});
