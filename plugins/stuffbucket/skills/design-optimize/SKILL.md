---
name: design-optimize
description: Diagnose and fix UI performance across loading speed, rendering, animations, images, and bundle size. Use when asked about slow, laggy, janky, performance, bundle size, load time, or wanting a faster, smoother experience.
metadata:
  author: stuffbucket
  version: 1.0.0
---

Identify and fix performance issues to create faster, smoother user experiences.

## Assess Performance Issues

Understand current performance and identify problems:

1. **Measure current state**:
   - **Core Web Vitals**: LCP, FID/INP, CLS scores
   - **Load time**: Time to interactive, first contentful paint
   - **Bundle size**: JavaScript, CSS, image sizes
   - **Runtime performance**: Frame rate, memory usage, CPU usage
   - **Network**: Request count, payload sizes, waterfall

2. **Identify bottlenecks**:
   - What is slow? (Initial load? Interactions? Animations?)
   - What is causing it? (Large images? Expensive JavaScript? Layout thrashing?)
   - How bad is it? (Perceivable? Annoying? Blocking?)
   - Who is affected? (All users? Mobile only? Slow connections?)

Measure before and after. Premature optimization wastes time. Optimize what actually matters.

## Optimization Strategy

Create systematic improvement plan:

### Loading Performance

**Optimize images**:

- Use modern formats (WebP, AVIF)
- Proper sizing (do not load 3000px image for 300px display)
- Lazy loading for below-fold images
- Responsive images (`srcset`, `picture` element)
- Compress images (80-85% quality is usually imperceptible)
- Use CDN for faster delivery

```html
<img
  src="hero.webp"
  srcset="hero-400.webp 400w, hero-800.webp 800w, hero-1200.webp 1200w"
  sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px"
  loading="lazy"
  alt="Hero image"
/>
```

**Reduce JavaScript bundle**:

- Code splitting (route-based, component-based)
- Tree shaking (remove unused code)
- Remove unused dependencies
- Lazy load non-critical code
- Use dynamic imports for large components

```javascript
const HeavyChart = lazy(() => import('./HeavyChart'));
```

**Optimize CSS**: Remove unused CSS, critical CSS inline, rest async, minimize files, use CSS containment.

**Optimize fonts**:

- Use `font-display: swap` or `optional`
- Subset fonts (only characters you need)
- Preload critical fonts
- Use system fonts when appropriate
- Limit font weights loaded

```css
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+0020-007F;
}
```

**Optimize loading strategy**: Critical resources first (async/defer non-critical), preload critical assets, prefetch likely next pages, service worker for offline/caching, HTTP/2 or HTTP/3.

### Rendering Performance

**Avoid layout thrashing**:

```javascript
// Bad: Alternating reads and writes
elements.forEach(el => {
  const height = el.offsetHeight;
  el.style.height = height * 2;
});

// Good: Batch reads, then batch writes
const heights = elements.map(el => el.offsetHeight);
elements.forEach((el, i) => {
  el.style.height = heights[i] * 2;
});
```

**Optimize rendering**: Use CSS `contain`, minimize DOM depth, reduce DOM size, use `content-visibility: auto` for long lists, virtual scrolling for very long lists.

**Reduce paint and composite**: Use `transform` and `opacity` for animations (GPU-accelerated). Avoid animating layout properties. Use `will-change` sparingly.

### Animation Performance

**GPU acceleration**:

```css
/* GPU-accelerated (fast) */
.animated {
  transform: translateX(100px);
  opacity: 0.5;
}

/* CPU-bound (slow) */
.animated-slow {
  left: 100px;
  width: 300px;
}
```

**Smooth 60fps**: Target 16ms per frame. Use `requestAnimationFrame` for JS animations. Debounce/throttle scroll handlers. Use CSS animations when possible.

**Intersection Observer**:

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      // Element is visible, lazy load or animate
    }
  });
});
```

### React/Framework Optimization

**React-specific**: Use `memo()` for expensive components, `useMemo()` and `useCallback()` for
expensive computations, virtualize long lists, code split routes, avoid inline function creation in
render, use React DevTools Profiler.

**Framework-agnostic**: Minimize re-renders, debounce expensive operations, memoize computed values, lazy load routes and components.

### Network Optimization

**Reduce requests**: Combine small files, use SVG sprites for icons, inline small critical assets, remove unused third-party scripts.

**Optimize APIs**: Pagination, GraphQL for needed fields only, response compression (gzip, brotli), HTTP caching headers, CDN for static assets.

**Optimize for slow connections**: Adaptive loading based on connection, optimistic UI updates, request prioritization, progressive enhancement.

## Core Web Vitals Optimization

### Largest Contentful Paint (LCP < 2.5s)

Optimize hero images, inline critical CSS, preload key resources, use CDN, server-side rendering.

### First Input Delay (FID < 100ms) / INP (< 200ms)

Break up long tasks, defer non-critical JavaScript, use web workers for heavy computation.

### Cumulative Layout Shift (CLS < 0.1)

Set dimensions on images and videos, do not inject content above existing content, use `aspect-ratio`, reserve space for ads/embeds.

```css
.image-container {
  aspect-ratio: 16 / 9;
}
```

## Performance Monitoring

**Tools**: Chrome DevTools (Lighthouse, Performance panel), WebPageTest, Core Web Vitals, bundle analyzers, performance monitoring (Sentry, DataDog, New Relic).

**Key metrics**: LCP, FID/INP, CLS, TTI, FCP, TBT, bundle size, request count.

Measure on real devices with real network conditions. Desktop Chrome with fast connection is not representative.

**NEVER**:

- Optimize without measuring
- Sacrifice accessibility for performance
- Break functionality while optimizing
- Use `will-change` everywhere
- Lazy load above-fold content
- Optimize micro-optimizations while ignoring major issues
- Forget about mobile performance

## Verify Improvements

- **Before/after metrics**: Compare Lighthouse scores
- **Real user monitoring**: Track improvements for real users
- **Different devices**: Test on low-end Android, not just flagship iPhone
- **Slow connections**: Throttle to 3G, test experience
- **No regressions**: Ensure functionality still works
- **User perception**: Does it feel faster?
