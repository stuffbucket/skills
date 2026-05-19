# Design System Template

Distinguish between fixed foundations, project-specific brand decisions, and context-dependent adaptations.

---

## I. FIXED ELEMENTS

These remain constant across all projects.

### 1. Spacing Scale

Use multiples of 4px base unit:

```text
4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 96px
```

Apply to margins, padding, and gaps. Mathematical relationships ensure visual harmony.

### 2. Grid System

- **12-column grid** for most layouts (divisible by 2, 3, 4, 6)
- **16-column grid** for data-heavy interfaces
- **Gutters**: 16px (mobile), 24px (tablet), 32px (desktop)

### 3. Accessibility Standards

- **WCAG 2.1 AA** compliance minimum
- **Contrast**: 4.5:1 for normal text, 3:1 for large text
- **Touch targets**: Minimum 44x44px
- **Keyboard navigation**: All interactive elements accessible
- **Screen reader**: Semantic HTML, ARIA labels where needed

### 4. Typography Hierarchy Logic

- **Scale**: 1.25x (major third) or 1.333x (perfect fourth)
- **Levels**: Display > H1 > H2 > H3 > Body > Small > Caption
- **Line height**: 1.5x for body text, 1.2-1.3x for headlines
- **Line length**: 45-75 characters optimal

### 5. Component Architecture

- **Button states**: Default, Hover, Active, Focus, Disabled
- **Form structure**: Label above input, error below, helper text optional
- **Modal pattern**: Overlay + centered content + close mechanism
- **Card structure**: Container > Header > Body > Footer (optional)

### 6. Animation Timing

- **Lightweight** (icons, chips): 150ms
- **Standard** (cards, panels): 300ms
- **Weighty** (modals, pages): 500ms
- **Ease-out**: Entrances; **Ease-in**: Exits; **Ease-in-out**: Transitions

---

## II. PROJECT-SPECIFIC ELEMENTS

Fill in per project based on brand personality and purpose.

### 1. Brand Color System

```text
NEUTRALS (4-5 colors):
- Background lightest: _______
- Surface: _______
- Border/divider: _______
- Text secondary: _______
- Text primary: _______

ACCENTS (1-3 colors):
- Primary (main CTA): _______
- Secondary (alternative action): _______ (optional)
- Status: Success _______ / Warning _______ / Error _______ / Info _______
```

**Decide**: What emotion should the brand evoke? Warm or cool neutrals? Conservative or bold accents?

### 2. Typography Pairing

```text
HEADLINE FONT: _______
- Weight: _______  Personality: _______

BODY FONT: _______
- Weight: _______  Personality: _______

OPTIONAL ACCENT FONT: _______
```

**Pairing logic**: Serif + Sans-serif (editorial) | Geometric + Humanist (modern + warm) | Display + System (distinctive + efficient)

### 3. Tone of Voice

```text
BRAND PERSONALITY (1-10 scale):
- Formal ↔ Casual: _______
- Professional ↔ Friendly: _______
- Serious ↔ Playful: _______

MICROCOPY EXAMPLES:
- Button label (submit form): _______
- Error message (invalid email): _______
- Success message (saved): _______
- Empty state: _______
```

### 4. Animation Speed and Feel

```text
SPEED PREFERENCE:
- UI interactions: _______ (100-300ms)
- State changes: _______ (200-400ms)
- Page transitions: _______ (300-700ms)

STYLE: _______ (sharp / standard / bouncy)
MOVEMENT: _______ (minimal / smooth / expressive)
```

---

## III. ADAPTABLE ELEMENTS

Context-dependent implementations that vary by use case.

### 1. Component Variations

- **Primary**: Full background (high emphasis, one per section)
- **Secondary**: Outline (medium emphasis)
- **Tertiary**: Text only (low emphasis)
- **Destructive**: Red-ish (danger actions)
- **Ghost**: Minimal (navigation, toolbars)

### 2. Responsive Breakpoints

| Token | Range | Notes |
| ------- | ------- | ------- |
| XS | 0-479px | Small phones |
| SM | 480-767px | Large phones |
| MD | 768-1023px | Tablets |
| LG | 1024-1439px | Laptops |
| XL | 1440px+ | Desktop |

Adapt layout strategy to content type: content sites stay narrow; dashboards use full width with panels.

### 3. Dark Mode

Not a simple inversion. Reduce contrast slightly for eye comfort:

- Light: white background, slate-900 text (21:1)
- Dark: slate-900 background, slate-200 text (~15.8:1, still AA)

### 4. Loading States

- **<500ms**: No indicator (feels instant)
- **500ms-2s**: Spinner or skeleton
- **>2s**: Progress bar with percentage or skeleton + estimated time
- **Buttons**: Show spinner inside (keep visible state, not just disabled)

### 5. Error Handling

- **Forms**: Validate on blur, display inline below field, clear error on fix
- **API transient** (network): Show retry button
- **API permanent** (404): Helpful message + next steps
- **API critical** (500): Contact support option
- **Data missing**: Empty state with action; **corrupt**: Error boundary + reload

---

## DECISION TREE

For each feature, ask:

1. **Fixed?** Affects structure, accessibility, or universal UX? Use the fixed system.
2. **Project-specific?** Expresses brand personality or purpose? Fill in the template.
3. **Adaptable?** Depends on context, content, or use case? Choose appropriate variation.

---

## PROJECT KICKOFF TEMPLATE

```text
PROJECT NAME: _______________________
PURPOSE: ____________________________

BRAND PERSONALITY:
- Primary emotion: _______
- Warm or cool: _______
- Formal or casual: _______
- Conservative or bold: _______

COLORS:
- Neutral base: _______
- Primary accent: _______
- Status colors: _______ / _______ / _______

TYPOGRAPHY:
- Headline font: _______
- Body font: _______
- Pairing rationale: _______

TONE:
- Button labels style: _______
- Error message style: _______
- Success message style: _______

ANIMATION:
- Speed: _______ (fast/moderate/slow)
- Feel: _______ (sharp/smooth/bouncy)

TARGET DEVICES:
- Primary: _______ (mobile/desktop/both)
- Secondary: _______
```

---

## VALIDATION CHECKLIST

### Fixed Elements

- [ ] Uses spacing scale (4/8/12/16/24/32/48/64/96px)
- [ ] Follows grid system (12 or 16 columns)
- [ ] Meets WCAG AA contrast (4.5:1 normal, 3:1 large)
- [ ] Touch targets >= 44px
- [ ] Typography follows mathematical scale
- [ ] Components follow standard architecture

### Project-Specific Elements

- [ ] Brand colors filled in and intentional
- [ ] Typography pairing chosen and justified
- [ ] Tone of voice defined and consistent
- [ ] Animation speed matches brand personality

### Adaptable Elements

- [ ] Component variants appropriate for context
- [ ] Responsive behavior fits content type
- [ ] Loading states match operation duration
- [ ] Error handling fits error type
