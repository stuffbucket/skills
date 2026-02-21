---
name: testing-skill
description: Writing and running tests. Use when creating unit tests, integration tests, end-to-end tests, choosing testing frameworks, structuring test files, writing assertions, mocking dependencies, measuring coverage, or debugging failing tests. Covers JavaScript (Jest, Vitest, Node test runner), Python (pytest), and general testing patterns.
allowed-tools: read_file write_file list_directory
---

# Testing

## Test File Placement

Mirror the source tree with a test suffix:

| Source | Test |
|---|---|
| `src/utils.js` | `src/utils.test.js` or `tests/utils.test.js` |
| `lib/parser.py` | `tests/test_parser.py` |
| `plugins/router/server.js` | `plugins/router/server.test.js` |

Co-located tests (`.test.js` next to source) are preferred for unit tests. Separate `tests/` directories are better for integration/e2e tests.

## Test Structure

Use the Arrange-Act-Assert pattern:

```javascript
test("calculates total with tax", () => {
  // Arrange
  const items = [{ price: 10 }, { price: 20 }];
  const taxRate = 0.1;

  // Act
  const total = calculateTotal(items, taxRate);

  // Assert
  expect(total).toBe(33);
});
```

```python
def test_calculates_total_with_tax():
    # Arrange
    items = [{"price": 10}, {"price": 20}]
    tax_rate = 0.1

    # Act
    total = calculate_total(items, tax_rate)

    # Assert
    assert total == 33
```

## Naming Conventions

Test names should describe the behavior, not the implementation:

```
✓ "returns empty array when no skills match query"
✗ "test filter function"

✓ "rejects names longer than 64 characters"
✗ "test validation"

✓ "resolves fuzzy prefix to exact skill name"
✗ "test fuzzyFindSkill"
```

Pattern: `<action> when <condition>` or `<expected result> given <input>`

## What to Test

### Always test
- Public API / exported functions
- Edge cases: empty input, null, boundary values, very large input
- Error paths: invalid input, missing files, network failures
- State transitions: before/after side effects

### Skip testing
- Private implementation details (test through public API)
- Framework/library internals
- Simple getters/setters with no logic
- Generated code

## Mocking

Mock external dependencies, not internal logic:

```javascript
// Mock a file system call
const fs = require("fs");
jest.mock("fs");
fs.readFileSync.mockReturnValue('{"skills": []}');

// Mock a network request
const fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: [] }),
});
```

```python
# Mock a file read
from unittest.mock import patch, mock_open

@patch("builtins.open", mock_open(read_data='{"skills": []}'))
def test_loads_index(mock_file):
    result = load_index()
    assert result == {"skills": []}
```

Rules:
- Mock at the boundary (fs, network, database, clock)
- Don't mock the thing you're testing
- Prefer dependency injection over patching when possible
- Reset mocks between tests

## Framework Quick Reference

### Node.js built-in test runner (v22+)

```javascript
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

describe("skill-router", () => {
  test("returns all skills when no query", () => {
    const result = searchSkills(null);
    assert.ok(result.length > 0);
  });
});
```

Run: `node --test`

### Jest / Vitest

```javascript
describe("skill-router", () => {
  it("returns all skills when no query", () => {
    const result = searchSkills(null);
    expect(result.length).toBeGreaterThan(0);
  });
});
```

Run: `npx jest` or `npx vitest`

### pytest

```python
import pytest

def test_returns_all_skills_when_no_query():
    result = search_skills(None)
    assert len(result) > 0

@pytest.mark.parametrize("query,expected", [
    ("file", "file-management-skill"),
    ("analysis", "code-analysis-skill"),
])
def test_filters_by_keyword(query, expected):
    result = search_skills(query)
    assert result[0]["name"] == expected
```

Run: `python -m pytest`

## Debugging Failing Tests

1. Read the assertion error message — what was expected vs. actual?
2. Check if the test is wrong (stale expectations, wrong assumptions)
3. Check if the code is wrong (regression, unhandled edge case)
4. Isolate: run only the failing test (`--grep`, `-k`, `.only`)
5. Add logging at the boundary between arrange and act
6. Check test order dependencies: does it pass when run alone?

## Coverage

Coverage measures which lines/branches execute during tests. Aim for meaningful coverage, not 100%:

- **80%+ line coverage** is a reasonable target for most projects
- **100% branch coverage** on critical paths (payment, auth, data mutation)
- **0% is fine** on generated code, type definitions, config files

Run coverage:
```bash
npx jest --coverage
python -m pytest --cov=src --cov-report=term-missing
```

Look at the uncovered lines — they reveal untested edge cases and error paths.
