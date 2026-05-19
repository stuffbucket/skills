# Accessibility Essentials

Treat accessibility as a foundation, not a limitation. Target WCAG 2.1 AA compliance minimum.

## Core Principles (POUR)

- **Perceivable**: Provide alt text, sufficient contrast, captions
- **Operable**: Support keyboard and touch navigation
- **Understandable**: Keep behavior clear and predictable
- **Robust**: Ensure compatibility with assistive technologies

## Contrast Requirements

| Element | Minimum Ratio |
| --------- | --------------- |
| Normal text | 4.5:1 |
| Large text (18pt+) | 3:1 |
| UI components | 3:1 |

**Tools**: Chrome DevTools Accessibility tab, WebAIM Contrast Checker

## Keyboard Navigation

```tsx
// Add focus states to all interactive elements
<button className="focus:ring-4 focus:ring-blue-500 focus:outline-none">
  Accessible
</button>

// Make custom elements keyboard-accessible with tabIndex={0} and key handlers
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick()}
>
  Custom Button
</div>
```

> **WARNING: Never use positive tabindex values.** Values like `tabIndex={1}`,
> `tabIndex={2}`, etc. override the natural DOM tab order and create an
> unpredictable, fragile navigation sequence. Use only `tabIndex={0}` (add to
> natural tab order) or `tabIndex={-1}` (programmatically focusable, not in tab
> order). Rely on DOM source order to control navigation sequence.
>
> **Essentials:**

- Tab through entire interface
- Enter/Space activates elements
- Escape closes modals
- Provide visible focus indicators always

## Essential ARIA

```tsx
// Label buttons that have no visible text
<button aria-label="Close dialog"><X /></button>

// Mark expandable elements
<button aria-expanded={isOpen} aria-controls="menu">Menu</button>

// Announce dynamic content to screen readers
<div role="status" aria-live="polite">{statusMessage}</div>
<div role="alert" aria-live="assertive">{errorMessage}</div>

// Associate form errors with their inputs
<input aria-invalid={hasError} aria-describedby="error-msg" />
{hasError && <p id="error-msg" role="alert">Error text</p>}
```

## Semantic HTML

```tsx
// Use semantic elements instead of divs
<header><nav>...</nav></header>
<main><article><h1>...</h1></article></main>
<footer>...</footer>

// Maintain heading hierarchy (never skip levels)
<h1>Page Title</h1>
  <h2>Section</h2>
    <h3>Subsection</h3>
```

## Touch Targets

- Set minimum **44x44px** for all interactive elements
- Add adequate spacing between targets
- Apply `touch-manipulation` CSS for responsive touch

## Screen Reader Content

```tsx
// Hide visually but keep announced
<span className="sr-only">Additional context</span>

// Provide a skip link for keyboard users
<a href="#main" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

## Quick Checklist

- [ ] Keyboard: Can tab through everything
- [ ] Focus: Visible focus indicators on all interactive elements
- [ ] Contrast: 4.5:1 for text, 3:1 for UI components
- [ ] Alt text: All informative images have descriptive alt; decorative images use alt=""
- [ ] Headings: Logical h1-h6 hierarchy, no skipped levels
- [ ] Forms: Labels associated with inputs via for/id or wrapping
- [ ] Errors: Announced to screen readers via role="alert" or aria-live
- [ ] Touch: 44px minimum targets
- [ ] Tabindex: Only 0 or -1; never positive values

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
