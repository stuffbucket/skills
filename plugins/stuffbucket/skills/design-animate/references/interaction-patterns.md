# Interaction Patterns

## Animation Principles

### Easing

- **Ease-out** (decelerating): entering elements
- **Ease-in** (accelerating): exiting elements
- **Ease-in-out**: moving between positions
- **Linear**: only for continuous animations (progress bars)

### Duration Scale

- Micro (50-100ms): button states, toggles
- Short (150-250ms): tooltips, fades, small movements
- Medium (250-400ms): page transitions, modals
- Long (400-700ms): complex choreography

### Motion Principles

- **Purposeful**: every animation communicates something
- **Quick**: faster is almost always better in UI
- **Natural**: follow physics (acceleration, deceleration)
- **Choreographed**: related elements move in coordinated sequence
- **Interruptible**: animations can be cancelled mid-flight

### Animation Types

- **Entrance**: fade in, slide in, scale up
- **Exit**: fade out, slide out, scale down
- **Emphasis**: pulse, shake, bounce
- **Transition**: morph, crossfade, shared element
- **Loading**: skeleton shimmer, spinner, progress

### Stagger and Sequence

- Stagger related items by 30-50ms each
- Lead with the most important element
- Limit total sequence to under 700ms
- Use consistent direction for related movements

### Rules

- Support `prefers-reduced-motion`
- Don't animate for the sake of it
- Test on low-powered devices
- Keep animations under 400ms for responsive feel
- Use `will-change` or `transform` for performance

## Micro-Interactions

### Framework

1. **Trigger**: User action (click, hover, swipe), system event (notification, completion), conditional (time-based, threshold)
2. **Rules**: Logic and sequence, conditions and branching
3. **Feedback**: Visual (color, size, position), motion (animation, transition), audio (click, chime), haptic (vibration)
4. **Loops and Modes**: Repeat behavior, first-time vs repeat, progressive disclosure

### Common Micro-Interactions

- Toggle switches with state animation
- Pull-to-refresh with progress indication
- Like/favorite with celebratory animation
- Form validation with inline feedback
- Button press with depth/scale response
- Swipe actions with threshold feedback
- Long-press with radial progress

### Spec Format

For each: name, trigger, rules (sequence), feedback (visual/audio/haptic), duration/easing, loop behavior, accessibility considerations.

### Rules

- Every micro-interaction must have a purpose
- Keep durations short (100-500ms for most)
- Provide immediate feedback for user actions
- Respect reduced-motion preferences
- Test on target devices for performance

## Feedback Patterns

### Feedback Types

- **Immediate**: Button state change, inline validation, toggle response, drag position update
- **Confirmation**: Success toast/snackbar, checkmark animation, summary of action, undo option
- **Status**: Progress indicators, status badges (pending/active/complete), activity indicators (typing/uploading/syncing)
- **Notification**: In-app notifications, badge counts, banner alerts, push notifications

### Feedback Channels

- **Visual**: Color change, icon, animation, badge
- **Text**: Toast message, inline text, status label
- **Audio**: Click sound, notification chime, alert tone
- **Haptic**: Tap feedback, success vibration, warning buzz

### Feedback Hierarchy

1. Inline/contextual -- closest to the action (preferred)
2. Component-level -- within the current component
3. Page-level -- banner or toast
4. System-level -- notification outside current view

### Duration and Dismissal

- Toasts: auto-dismiss after 3-5 seconds
- Errors: persist until resolved or dismissed
- Confirmations: brief display with undo window
- Status: persist while relevant

### Rules

- Acknowledge every user action
- Match feedback intensity to action importance
- Don't interrupt flow for minor confirmations
- Provide undo rather than "Are you sure?"
- Ensure feedback is accessible (not color-only)

## Loading States

### Patterns

- **Skeleton Screens**: Show layout shape before content loads. Use for known structure. Animate with subtle shimmer.
- **Spinner/Progress**: Indeterminate spinner for unknown duration. Determinate bar when progress is measurable. Keep small and unobtrusive.
- **Progressive Loading**: Critical content first, enhance progressively. Lazy-load below-fold. Blur-up images.
- **Optimistic UI**: Show expected result immediately. Reconcile with server. Roll back on failure.
- **Placeholder Content**: Show placeholder text/images. Use realistic proportions. Smooth transition to real content.

### Duration Guidelines

- Under 100ms: no indicator needed
- 100ms-1s: subtle indicator (opacity change, skeleton)
- 1-10s: clear loading state with progress if possible
- Over 10s: detailed progress, time estimate, background option

### Transition Behavior

- Fade content in (don't pop)
- Stagger list items by 30-50ms
- Avoid layout shifts when content loads
- Maintain scroll position on content refresh

### Rules

- Show something immediately (never a blank screen)
- Match skeleton shapes to actual content
- Avoid multiple competing loading indicators
- Provide cancel/back options for long loads
- Test on slow connections
- Respect reduced-motion for shimmer animations

## Error Handling UX

### Error Hierarchy

1. **Prevention**: Inline validation, smart defaults, confirmation dialogs, constraint-based inputs, auto-save
2. **Detection**: Real-time field validation, form-level validation on submit, network error detection, timeout handling, auth checks
3. **Communication**: Clear human language (not codes), explain what happened and why, tell user what to do next, place messages near source, use appropriate severity
4. **Recovery**: Preserve user input, offer retry for transient failures, provide alternative paths, auto-retry with backoff, undo for accidents

### Error Message Format

- **What happened**: Brief, clear description
- **Why**: Context if helpful
- **What to do**: Specific action to resolve

### Error States by Context

- **Forms**: Inline per-field + summary at top
- **Pages**: Full-page error with retry/back options
- **Network**: Toast/banner with retry
- **Empty results**: Helpful empty state with suggestions
- **Permissions**: Explain access needed and how to get it

### Rules

- Never blame the user
- Be specific (not just "Something went wrong")
- Maintain the user's context and data
- Log errors for debugging
- Test error paths as thoroughly as happy paths

## State Machines

### Components

- **States**: Distinct modes (idle, loading, success, error)
- **Events**: Triggers (click, submit, timeout, response)
- **Transitions**: Rules for state changes
- **Actions**: Side effects during transitions (fetch, toast, log)
- **Guards**: Conditions for transitions (isValid, hasPermission)

### Common UI State Machines

- **Form**: idle -> editing -> validating -> submitting -> success/error -> idle
- **Data Fetching**: idle -> loading -> success/error, error -> retrying -> success/error
- **Authentication**: logged-out -> authenticating -> logged-in -> logging-out -> logged-out
- **Multi-Step Wizard**: step1 -> step2 -> step3 -> review -> submitting -> complete

### Modeling Approach

1. List all possible states
2. List all events/triggers
3. Define valid transitions
4. Identify impossible states to prevent
5. Add guards for conditional transitions
6. Define entry/exit actions per state

### Benefits

- Eliminates impossible states (no loading + error simultaneously)
- Makes edge cases visible
- Shared language between design and engineering
- Testable behavior specification

### Rules

- Start with the happy path, then add error states
- Every state must have a way out (no dead ends)
- Keep state machines focused (one per concern)
- Document with visual diagrams
- Map each state to a UI representation

## Gesture Patterns

### Core Gestures

- **Tap**: Select, activate, toggle
- **Double tap**: Zoom, like/favorite
- **Long press**: Context menu, reorder mode, preview
- **Swipe**: Navigate, dismiss, reveal actions
- **Pinch**: Zoom in/out
- **Rotate**: Rotate content (maps, images)
- **Drag**: Move, reorder, adjust values
- **Pull**: Refresh content

### Discoverability

- Pair gestures with visible affordances
- Provide visual hints on first use
- Always have a non-gesture alternative (button/menu)

### Feedback

- Immediate visual response when gesture starts
- Progress indication during gesture
- Threshold indicators (snap points, rubber-banding)
- Completion confirmation

### Thresholds

- Minimum distance before activation (10-15px)
- Velocity thresholds for flick/swipe
- Direction lock (horizontal vs vertical)
- Cancel zone (return to start to abort)

### Conflict Resolution

- Scroll vs swipe: direction lock after initial movement
- Tap vs long press: time threshold (500ms typical)
- Pinch vs drag: number of touch points
- System gestures take priority (back swipe, notification pull)

### Accessibility

- Every gesture must have a non-gesture alternative
- Support switch control and voice control
- Document custom gestures
- Respect reduced-motion for gesture animations

### Rules

- Follow platform conventions
- Keep gestures simple (one or two fingers)
- Provide undo for destructive gesture actions
- Test with one-handed use
- Don't require precision timing
