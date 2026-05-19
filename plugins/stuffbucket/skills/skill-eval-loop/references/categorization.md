# Categorizing Eval Failures

Every failure falls into one of three buckets. Each has distinct diagnostic signals and a different fix location. Applying the wrong category's fix makes things worse.

## Skill Weakness

The model produced output that genuinely violates the skill's rules or misses its intent.

### Diagnostic questions

- Does the model's output include the banned pattern in a position where it would ship (CSS declaration, code output, final report)?
- Did the model stop at a partial workflow step (e.g., proposal without deliverable)?
- Did the model emit a literal cross-reference command as its entire response (`/other-skill`)?
- Did the model ignore an inline rule, table, or requirement stated in the SKILL.md body?
- Is the model relying on training-data defaults instead of the skill's provided options?

### Examples

- `font-family: 'Inter', sans-serif;` in the output CSS (banned in the skill)
- Response ends with "Let me know which candidate you prefer" and no code
- Response is just `/design-context` with nothing else
- Model recommends `#3B82F6` when the skill said to use OKLCH

### Fix location

SKILL.md body. See `fix-patterns.md` for specific edit recipes.

---

## False Positive

The model did the right thing but the assertion penalized it.

### Diagnostic questions

- Does the model's actual output satisfy the spirit of the test, even if the assertion says it doesn't?
- Is the banned pattern in a diagnostic/critical context ("replace the existing Inter with...") rather than an active recommendation?
- Did the assertion throw an error (`Got type undefined`)?
- Is the match triggering on a substring within a legitimate word (`Inter` in `interface`)?
- Is the LLM-rubric grader failing because it has no API key?

### Examples

- Model says "the current Inter font is generic, replace with Outfit" → `not-icontains 'Inter'` fails
- Model correctly uses OKLCH and mentions WCAG, rubric threshold is 0.5 but grader returns `undefined` due to bad object shape
- Model says "the interfaces should use..." → `not-icontains 'Inter'` fails
- Assertion error: "Custom function must return a boolean, number, or GradingResult object"

### Fix location

`evals/assertions/*.js` or the inline `javascript` value in the test YAML. See `fix-patterns.md`.

---

## Test Design Issue

The test asks for contradictory behavior, or provides insufficient inputs for the skill to produce what the assertion checks.

### Diagnostic questions

- Does the test provide the inputs the skill needs to do its job?
- Does one assertion in the test contradict another (e.g., "asks for context" and "emits CSS")?
- Is the test prompt vague in a way that triggers the skill's gating behavior?
- Does the assertion expect behavior the skill explicitly refuses to do?

### Examples

- Test: "Do a UX audit" (no code) + assertion: "Uses severity ratings" → skill correctly refuses → no severity ratings to grade
- Test: "Design a page" (no audience, no brand) + assertion: "Commits to specific aesthetic" → skill correctly asks for context → no aesthetic to grade
- Test asserts both `icontains 'asks for'` and `icontains 'generated code'` — can't both be true

### Fix location

`evals/tests/*.yaml`. See `fix-patterns.md`.

---

## Decision Tree

1. **Read the full model output.** Not just the grader's reason.
2. **Ask: did the model do the right thing?**
   - If **no** → skill weakness. Look at what rule was violated.
   - If **yes** but test failed → not a skill weakness. Continue.
3. **Ask: does the test's assertion make sense given the model's output?**
   - If the assertion is correct but the matching logic is wrong → false positive. Fix the assertion.
   - If the assertion is asking for something the test inputs don't support → test design issue. Fix the test.
4. **Apply the fix from the corresponding bucket.**
5. **Re-run targeted (filter to this test only).** Confirm the fix landed.

## Mixed cases

Sometimes a single failure has multiple causes. Example: model recommends
Inter in CSS (skill weakness) AND the `not-icontains` check is too broad
(false positive). Fix both — starting with the skill weakness, because fixing
the assertion alone would mask the real issue.

When uncertain, favor fixing the skill. A skill that produces the right output regardless of assertion pickiness is more robust than one that relies on permissive assertions.
