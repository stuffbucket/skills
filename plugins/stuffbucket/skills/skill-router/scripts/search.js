// Shared search module — single source of truth for skill search logic.
//
// Used by:
//   - mcp-server.js  (CJS require)
//   - catalog UI      (Vite bundles CJS → ESM)
//
// Provides blended semantic + fuzzy search with consistent stemming,
// Fuse.js configuration, and ranking across all search surfaces.

const Fuse = require("fuse.js");

// ---------------------------------------------------------------------------
// Stemmer — lightweight Porter-ish suffix stripping
// ---------------------------------------------------------------------------

function stem(word) {
  let w = word.toLowerCase();
  if (w.length < 4) return w;

  const rules = [
    [/ational$/, "ate"],
    [/tional$/, "tion"],
    [/encies$/, "ence"],
    [/izing$/, "ize"],
    [/ising$/, "ise"],
    [/ating$/, "ate"],
    [/ities$/, "ity"],
    [/ness$/, ""],
    [/ment$/, ""],
    [/ings$/, ""],
    [/tion$/, "t"],
    [/sion$/, "s"],
    [/ling$/, "le"],
    [/ally$/, "al"],
    [/ful$/, ""],
    [/ing$/, ""],
    [/ies$/, "y"],
    [/ous$/, ""],
    [/ive$/, ""],
    [/ble$/, ""],
    [/ers$/, ""],
    [/ion$/, ""],
    [/ed$/, ""],
    [/ly$/, ""],
    [/es$/, ""],
    [/er$/, ""],
    [/al$/, ""],
    [/s$/, ""],
  ];

  for (const [pattern, replacement] of rules) {
    if (pattern.test(w)) {
      const stemmed = w.replace(pattern, replacement);
      if (stemmed.length >= 3) return stemmed;
    }
  }
  return w;
}

function stemTokens(str) {
  return str
    .toLowerCase()
    .split(/[\s,\-_]+/)
    .filter((t) => t.length >= 2)
    .map(stem);
}

// ---------------------------------------------------------------------------
// Semantic index lookup — suffix-stripping term resolver
// ---------------------------------------------------------------------------

const LOOKUP_SUFFIXES = [
  "ation",
  "ment",
  "ness",
  "ting",
  "ing",
  "ble",
  "ous",
  "ive",
  "ful",
  "ize",
  "ise",
  "ted",
  "led",
  "ged",
  "ked",
  "ned",
  "red",
  "sed",
  "ed",
  "ly",
  "er",
  "es",
  "al",
  "s",
];

function lookupTerm(idx, term) {
  if (idx[term]) return idx[term];

  for (const sfx of LOOKUP_SUFFIXES) {
    if (term.length > sfx.length + 2 && term.endsWith(sfx)) {
      const base = term.slice(0, -sfx.length);
      if (idx[base]) return idx[base];
      if (idx[base + "e"]) return idx[base + "e"];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fuse.js — consistent configuration across all search surfaces
// ---------------------------------------------------------------------------

const FUSE_CONFIG = {
  keys: [
    { name: "name", weight: 3 },
    { name: "tags", weight: 2 },
    { name: "_stemmed", weight: 1.5 },
    { name: "description", weight: 1 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  includeScore: true,
  useExtendedSearch: false,
};

/**
 * Build a Fuse instance from a skill array, enriching each item with
 * stemmed searchable text.
 *
 * @param {Array} skills — array of skill objects (must have name, description, tags)
 * @returns {{ fuse: Fuse, items: Array }}
 */
function createFuse(skills) {
  const enriched = skills.map((s) => ({
    ...s,
    _stemmed: stemTokens(
      [s.name, s.description, ...(s.tags || [])].join(" "),
    ).join(" "),
  }));

  return {
    fuse: new Fuse(enriched, FUSE_CONFIG),
    items: enriched,
  };
}

// ---------------------------------------------------------------------------
// Blended search — semantic-first with Fuse.js complement
// ---------------------------------------------------------------------------

/**
 * Search skills using blended semantic + fuzzy matching.
 *
 * Semantic results (from pre-computed embedding similarity) are ranked first.
 * Fuse.js fuzzy results fill in anything the semantic index missed.
 * When no semantic index is available, falls back to Fuse-only.
 *
 * @param {string} query
 * @param {object} opts
 * @param {Fuse}   opts.fuse          — Fuse instance from createFuse()
 * @param {Array}  opts.items         — enriched items array from createFuse()
 * @param {object} [opts.semanticIdx] — pre-computed { term: [[id, score], …] }
 * @param {string} [opts.idField]     — field on items matching semantic index keys (default: 'name')
 * @returns {Array} ranked skill items
 */
function blendedSearch(
  query,
  { fuse, items, semanticIdx = null, idField = "name" },
) {
  if (!query) return items;

  // --- Semantic lookup ---
  let semIds = null;
  if (semanticIdx) {
    const terms = query.toLowerCase().match(/\b[a-z][a-z0-9]+\b/g);
    if (terms && terms.length) {
      const scores = {};
      let anyHit = false;

      for (const term of terms) {
        const matches = lookupTerm(semanticIdx, term);
        if (matches) {
          anyHit = true;
          for (const [id, score] of matches) {
            scores[id] = Math.max(scores[id] || 0, score);
          }
        }
      }

      if (anyHit) {
        semIds = Object.entries(scores)
          .filter(([, s]) => s >= 0.35)
          .sort(([, a], [, b]) => b - a)
          .map(([id]) => id);
      }
    }
  }

  // --- Fuse.js search (raw + stemmed query) ---
  const stemmedQuery = stemTokens(query).join(" ");
  const rawResults = fuse.search(query);
  const stemResults =
    stemmedQuery !== query.toLowerCase() ? fuse.search(stemmedQuery) : [];

  const fuseMap = new Map();
  for (const r of [...rawResults, ...stemResults]) {
    const id = r.item[idField];
    const existing = fuseMap.get(id);
    if (!existing || r.score < existing.score) {
      fuseMap.set(id, r);
    }
  }
  const fuseRanked = Array.from(fuseMap.values()).sort(
    (a, b) => a.score - b.score,
  );

  // --- Blend: semantic first, Fuse complement ---
  if (semIds && semIds.length > 0) {
    const itemMap = new Map(items.map((i) => [i[idField], i]));
    const seen = new Set();
    const result = [];

    for (const id of semIds) {
      const item = itemMap.get(id);
      if (item) {
        result.push(item);
        seen.add(id);
      }
    }

    for (const r of fuseRanked) {
      const id = r.item[idField];
      if (!seen.has(id)) {
        seen.add(id);
        result.push(r.item);
      }
    }

    return result;
  }

  // No semantic results — Fuse only
  return fuseRanked.map((r) => r.item);
}

module.exports = { stem, stemTokens, lookupTerm, createFuse, blendedSearch };
