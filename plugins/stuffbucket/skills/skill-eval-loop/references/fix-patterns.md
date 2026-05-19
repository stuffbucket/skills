# Fix Patterns by Category

Specific edit recipes for each failure category.

## Skill Weakness Fixes

### Recipe: Model reaches for a banned pattern from training priors

**Symptom**: Model emits `font-family: 'Inter', sans-serif;` or `background: #3B82F6;` despite bans.

**Fix**: Don't fight the prior — give a better default inline. Replace the negative-framing ban list with a positive approved-options table at the top of the skill body:

```markdown
## Font Requirements

When generating UI code, pick from this table. Do not propose fonts
outside this table.

| Context | Pairing | Heading | Body |
|---------|---------|---------|------|
| SaaS UI | S1 | Plus Jakarta Sans | Plus Jakarta Sans |
| SaaS UI | S2 | Outfit | Source Sans 3 |
| Editorial | E1 | Fraunces | Commissioner |
```

Then strengthen the ban in a second paragraph:

```markdown
Never name these fonts anywhere in the response — not as recommendations,
not as comparisons, and not in diagnostic critique of existing code:
Inter, Roboto, Arial, Open Sans, Helvetica Neue, Space Grotesk. If the
existing code uses one, describe it as "the current sans-serif" or
"the browser default" — never quote its name.
```

### Recipe: Model stops at proposal, never ships deliverable

**Symptom**: Eval sees "I'll propose candidates, let me know which you prefer" with no code/content.

**Fix**: Require the deliverable in every response. Add this near the top of the skill:

```markdown
**Every response must ship working [CSS / code / report].** Even the
proposal round includes the full [deliverable] so the user can react
to concrete output. Do not stop at candidate names and wait for
confirmation — always include [the specific artifact] for the top
candidate. The question comes *after* the deliverable, not instead of it.
```

Then rewrite workflow steps that previously said "Propose" to say "Propose with CSS" — listing exactly what the response must contain.

### Recipe: Model emits bare cross-reference command

**Symptom**: Model output is literally `/design-context` or `/other-skill` and nothing else.

**Fix**: Remove "Invoke /other-skill" from mandatory preparation. Replace with inline guidance:

```markdown
## Before Starting

Check for a `.design-context.md` file or a **Design Context** section
in loaded instructions. If missing, ask the user about target audience,
brand personality, and use cases before proceeding.
```

Cross-references should appear at the *end* of a response as next-step pointers, not at the start as literal commands to invoke.

### Recipe: Model ignores inline rules, uses training defaults

**Symptom**: SKILL.md has clear rules but model's output contradicts them.

**Fix**: The rule is probably in `references/` and getting skipped. Move it into the SKILL.md body. Add an explicit lookup table rather than prose description — tables are harder to ignore than sentences.

---

## False Positive Fixes

### Recipe: Substring match triggers on unrelated words

**Symptom**: `not-icontains 'Inter'` fails because output contains "interfaces" or "interactive".

**Fix**: Use word-boundary regex:

```yaml
# Before
- type: not-icontains
  value: 'Inter'

# After
- type: not-regex
  value: '\bInter\b'
```

Word boundaries (`\b`) only match whole words. Safe for all banned terms that are common substrings.

### Recipe: Pattern flagged in diagnostic context

**Symptom**: Model says "replace the existing Inter with Outfit" and the check fires on "Inter".

**Fix**: Scope the check to where the pattern would actually ship — CSS declarations, code blocks, specific output structures. Example JS assertion:

```javascript
const fontFamilyPattern = /font[_-]?family\s*:\s*[^;]+/gi;
const customPropPattern = /--[a-z0-9-]*font[a-z0-9-]*\s*:\s*[^;]+/gi;
const declarations = [
  ...(text.match(fontFamilyPattern) || []),
  ...(text.match(customPropPattern) || []),
];

for (const decl of declarations) {
  if (/\binter\b/i.test(decl)) {
    violations.push('Recommended banned font in CSS');
  }
}
```

Prose discussion no longer triggers the check.

### Recipe: JS assertion throws "Got type undefined"

**Symptom**: Assertion error `Custom function must return a boolean, number, or GradingResult object. Got type undefined: undefined`.

**Fix**: Promptfoo sometimes passes `output` as `{output: "...", tokenUsage: {...}}` instead of a string. Unwrap at the top of every JS assertion:

```javascript
module.exports = (output) => {
  let text = '';
  if (typeof output === 'string') text = output;
  else if (output && typeof output === 'object' && output.output) text = output.output;
  else if (output) text = String(output);

  // ... rest of assertion
};
```

Apply the same pattern to inline JS assertions in YAML tests.

### Recipe: LLM-rubric grader fails with "OPENAI_API_KEY not set"

**Symptom**: Rubric assertions fail with API key errors even though tests use a local provider.

**Fix**: Set the grader provider in `defaultTest.options.provider.text` to match the eval provider:

```yaml
defaultTest:
  options:
    timeout: 180000
    provider:
      text:
        id: 'ollama:chat:gemma4:latest'
        config:
          temperature: 0
          num_ctx: 8192
```

Now rubric grading uses the same local model, no API key needed.

---

## Test Design Issue Fixes

### Recipe: Test expects deliverable but provides no input

**Symptom**: Test prompt is "Do a UX audit" with no code; assertion expects severity-rated findings.

**Fix**: Provide the input inline:

```yaml
- description: 'Uses severity ratings'
  vars:
    message: |
      Review this form component:

      ```jsx
      <form onSubmit={handleSubmit}>
        <input placeholder="Email" type="email" />
        <input placeholder="Password" type="password" />
        <button type="submit">Submit</button>
      </form>
      ```
```

Now the skill has something to audit.

### Recipe: Test conflates two behaviors

**Symptom**: Single test asserts both "asks for context" (gating) and "emits CSS" (producing).

**Fix**: Split into two focused tests. One for the gating behavior with a deliberately vague prompt, one for the production behavior with full context inline.

```yaml
# Test 1: Context gating
- description: 'Asks for context when none provided'
  vars:
    message: 'Build me a dashboard.'
  assert:
    - type: icontains
      value: 'target audience'

# Test 2: Production with context
- description: 'Ships CSS when context provided'
  vars:
    message: |
      Context:
      - Audience: Portfolio managers
      - Tone: Confident, data-dense

      Build the dashboard.
  assert:
    - type: icontains
      value: 'font-family'
    - type: regex
      value: 'oklch\\('
```

### Recipe: Assertion threshold too strict

**Symptom**: Model output satisfies 3 of 4 rubric criteria, threshold is 0.75, scores 0.75 exactly and some graders round down to fail.

**Fix**: Set thresholds based on how many criteria matter. A 4-criteria rubric with 0.7 threshold means "at least 3 must pass". If all 4 must pass, remove the rubric and make it 4 separate assertions.

---

## Version Bumping

Every skill change needs a version bump. In the skill's frontmatter:

```yaml
metadata:
  author: your-org
  version: 1.2.0  # was 1.1.0
```

Use semver intent:

- Patch (`1.1.0 → 1.1.1`): typo fix, wording tweak, no behavior change
- Minor (`1.1.0 → 1.2.0`): new behavior, added guidance, expanded tables
- Major (`1.0.0 → 2.0.0`): restructured workflow, changed fundamental approach

The version lets you correlate eval results with skill changes — track which version each eval ran against.
