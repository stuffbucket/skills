---
name: design-harden
description: Improve interface resilience through better error handling, i18n support, text overflow handling, and edge case management. Makes interfaces robust and production-ready. Use when asked to harden, make production-ready, handle edge cases, add error states, or fix overflow and i18n issues.
metadata:
  author: stuffbucket
  version: 1.0.0
---

Strengthen interfaces against edge cases, errors, internationalization issues, and real-world usage scenarios that break idealized designs.

## Assess Hardening Needs

Identify weaknesses and edge cases:

1. **Test with extreme inputs**:
   - Very long text (names, descriptions, titles)
   - Very short text (empty, single character)
   - Special characters (emoji, RTL text, accents)
   - Large numbers (millions, billions)
   - Many items (1000+ list items, 50+ options)
   - No data (empty states)

2. **Test error scenarios**:
   - Network failures (offline, slow, timeout)
   - API errors (400, 401, 403, 404, 500)
   - Validation errors
   - Permission errors
   - Rate limiting
   - Concurrent operations

3. **Test internationalization**:
   - Long translations (German is often 30% longer than English)
   - RTL languages (Arabic, Hebrew)
   - Character sets (Chinese, Japanese, Korean, emoji)
   - Date/time formats
   - Number formats (1,000 vs 1.000)
   - Currency symbols

Designs that only work with perfect data are not production-ready. Harden against reality.

**Reference file** (read when assessing accessibility resilience):

- `references/accessibility.md` — WCAG 2.1 AA essentials, ARIA patterns, contrast requirements

## Hardening Dimensions

Systematically improve resilience:

### Text Overflow and Wrapping

**Long text handling**:

```css
/* Single line with ellipsis */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Multi-line with clamp */
.line-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Allow wrapping */
.wrap {
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}
```

**Flex/Grid overflow**:

```css
/* Prevent flex items from overflowing */
.flex-item {
  min-width: 0; /* Allow shrinking below content size */
  overflow: hidden;
}

/* Prevent grid items from overflowing */
.grid-item {
  min-width: 0;
  min-height: 0;
}
```

**Responsive text sizing**:

- Use `clamp()` for fluid typography
- Set minimum readable sizes (14px on mobile)
- Test text scaling (zoom to 200%)
- Ensure containers expand with text

### Internationalization (i18n)

**Text expansion**:

- Add 30-40% space budget for translations
- Use flexbox/grid that adapts to content
- Test with longest language (usually German)
- Avoid fixed widths on text containers

```jsx
// Bad: Assumes short English text
<button className="w-24">Submit</button>

// Good: Adapts to content
<button className="px-4 py-2">Submit</button>
```

**RTL (Right-to-Left) support**:

```css
/* Use logical properties */
margin-inline-start: 1rem; /* Not margin-left */
padding-inline: 1rem; /* Not padding-left/right */
border-inline-end: 1px solid; /* Not border-right */

/* Or use dir attribute */
[dir="rtl"] .arrow { transform: scaleX(-1); }
```

**Character set support**:

- Use UTF-8 encoding everywhere
- Test with CJK characters
- Test with emoji (they can be 2-4 bytes)
- Handle different scripts (Latin, Cyrillic, Arabic)

**Date/Time formatting**:

```javascript
// Use Intl API for proper formatting
new Intl.DateTimeFormat('en-US').format(date);
new Intl.DateTimeFormat('de-DE').format(date);

new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(1234.56);
```

**Pluralization**:

```javascript
// Bad: Assumes English pluralization
`${count} item${count !== 1 ? 's' : ''}`

// Good: Use proper i18n library
t('items', { count }) // Handles complex plural rules
```

### Error Handling

**Network errors**:

- Show clear error messages
- Provide retry button
- Explain what happened
- Offer offline mode if applicable
- Handle timeout scenarios

```jsx
{error && (
  <ErrorMessage>
    <p>Failed to load data. {error.message}</p>
    <button onClick={retry}>Try again</button>
  </ErrorMessage>
)}
```

**Form validation errors**:

- Inline errors near fields
- Clear, specific messages
- Suggest corrections
- Do not block submission unnecessarily
- Preserve user input on error

**API errors**:

- 400: Show validation errors
- 401: Redirect to login
- 403: Show permission error
- 404: Show not found state
- 429: Show rate limit message
- 500: Show generic error, offer support

**Graceful degradation**:

- Core functionality works without JavaScript
- Images have alt text
- Progressive enhancement
- Fallbacks for unsupported features

### Edge Cases and Boundary Conditions

**Empty states**: No items, no search results, no data. Provide clear next action.

**Loading states**: Initial load, pagination, refresh. Show what is loading and time estimates for long operations.

**Large datasets**: Pagination or virtual scrolling. Search/filter capabilities. Do not load all 10,000 items at once.

**Concurrent operations**: Prevent double-submission (disable button while loading). Handle race conditions. Optimistic updates with rollback.

**Permission states**: No permission to view/edit. Read-only mode. Clear explanation of why.

**Browser compatibility**: Polyfills for modern features. Fallbacks for unsupported CSS. Feature detection, not browser detection.

### Input Validation and Sanitization

**Client-side validation**: Required fields, format validation, length limits, pattern matching, custom rules.

**Server-side validation (always)**: Never trust client-side only. Validate and sanitize all inputs. Protect against injection. Rate limiting.

```html
<input
  type="text"
  maxlength="100"
  pattern="[A-Za-z0-9]+"
  required
  aria-describedby="username-hint"
/>
<small id="username-hint">
  Letters and numbers only, up to 100 characters
</small>
```

### Accessibility Resilience

**Keyboard navigation**: All functionality accessible via keyboard. Logical tab order. Focus management in modals. Skip links.

**Screen reader support**: Proper ARIA labels. Announce dynamic changes (live regions). Descriptive alt text. Semantic HTML.

**Motion sensitivity**:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**High contrast mode**: Test in Windows high contrast mode. Do not rely only on color. Provide alternative visual cues.

### Performance Resilience

**Slow connections**: Progressive image loading, skeleton screens, optimistic UI, offline support.

**Memory leaks**: Clean up event listeners, cancel subscriptions, clear timers, abort pending requests on unmount.

**Throttling and debouncing**:

```javascript
const debouncedSearch = debounce(handleSearch, 300);
const throttledScroll = throttle(handleScroll, 100);
```

## Testing Strategies

**Manual testing**: Test with extreme data, different languages, offline, slow connection (throttle to 3G), screen reader, keyboard-only, old browsers.

**Automated testing**: Unit tests for edge cases, integration tests for error scenarios, E2E for critical paths, visual regression, accessibility tests (axe, WAVE).

## Verify Hardening

Test thoroughly with edge cases:

- **Long text**: Names with 100+ characters
- **Emoji**: Emoji in all text fields
- **RTL**: Arabic or Hebrew
- **CJK**: Chinese/Japanese/Korean
- **Network issues**: Disable internet, throttle connection
- **Large datasets**: 1000+ items
- **Concurrent actions**: Click submit 10 times rapidly
- **Errors**: Force API errors, test all error states
- **Empty**: Remove all data, test empty states

**NEVER**:

- Assume perfect input
- Ignore internationalization
- Leave error messages generic ("Error occurred")
- Forget offline scenarios
- Trust client-side validation alone
- Use fixed widths for text
- Assume English-length text
- Block entire interface when one component errors
