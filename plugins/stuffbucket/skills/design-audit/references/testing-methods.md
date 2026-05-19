# Testing Methods

## Click Tests

### Test Types

- **First-click test**: Where do users click first for a given task?
- **Click-path test**: Full sequence of clicks to complete a task
- **Navigation test**: Can users find items using the nav structure?
- **Five-second test**: What do users remember after 5 seconds?

### Test Plan Structure

1. **Objective**: What navigation or findability question to answer
2. **Stimuli**: Screen designs or prototypes; identify pages/states to show
3. **Tasks**: Clear, goal-oriented tasks without UI hints. Example: "Where would you click to change your email address?"
4. **Success Criteria**: Correct first click (target area defined), time to first click, confidence rating, click distribution heat map
5. **Participants**: 20-50 for quantitative, recruitment criteria, segmentation

### Analysis

- First-click success rate (above 65% = good findability)
- Click distribution patterns
- Time analysis (hesitation = confusion)
- Confidence correlation with accuracy

### Rules

- Test one task per screen
- Define click target areas before testing
- Use realistic content, not lorem ipsum
- Don't give hints in task wording
- Compare alternative designs with the same tasks

## A/B Test Design

### Test Structure

1. **Hypothesis**: "If we [change], then [outcome] will [improve/decrease] because [rationale]."
2. **Variants**: Control (A) = current design. Treatment (B) = proposed change. Isolate one variable.
3. **Primary Metric**: Single most important measure. Must be measurable, relevant, sensitive to the change.
4. **Secondary Metrics**: Supporting measures and guardrails for unintended consequences.
5. **Sample Size**: Based on minimum detectable effect, baseline conversion, significance level (95%), power (80%).
6. **Duration**: Run until sample size reached. Account for weekly cycles (full weeks). Minimum 1-2 weeks.

### Pitfalls

- Peeking at results before completion
- Too many variants at once
- Metric not sensitive enough
- Sample size too small
- Not accounting for novelty effects
- Ignoring segmentation effects

### When Not to A/B Test

- Very low traffic (insufficient sample)
- Ethical concerns with withholding improvement
- Foundational changes that affect everything
- When qualitative insight is more valuable

### Rules

- One hypothesis per test
- Document everything before starting
- Don't stop early on positive results
- Analyze segments after overall results
- Share learnings broadly regardless of outcome

## Test Scenarios

### Scenario Structure

- **Context Setting**: Brief, realistic backstory giving the participant a reason to act without leading them
- **Task**: Specific goal, action-oriented, avoids UI terminology
- **Success Criteria**: Task completion (yes/no), time to complete, errors/wrong paths, assistance requests, self-reported difficulty (1-5)
- **Observation Guide**: Watch for hesitations, facial expressions, verbal comments, navigation choices, error recovery

### Task Types

- **Exploratory**: Find information (e.g., "Find the return policy")
- **Specific**: Complete a goal (e.g., "Add a blue shirt size M to your cart")
- **Comparative**: Choose between options
- **Open-ended**: Achieve a goal with multiple valid paths

### Writing Rules

- Use participant language, not product jargon
- Give motivation, not instructions
- One goal per task
- Don't reveal the UI path in task wording
- Include both simple and complex tasks

### Rules

- Pilot test scenarios before real sessions
- Order tasks from easy to hard
- Include a warm-up task
- Prepare follow-up questions per task
- Write more scenarios than needed (allow flexibility)

## Accessibility Test Plan

### Testing Layers

1. **Automated**: Axe, Lighthouse, WAVE. Catches ~30-40% of issues. Run on every page/state. Integrate into CI/CD.
2. **Manual**: Keyboard-only navigation, screen reader walkthrough, zoom to 200% and 400%, high contrast mode, reduced motion mode.
3. **Assistive Technology**: Screen readers (VoiceOver, NVDA, TalkBack), voice control (Voice Control, Dragon), switch control, screen magnification.
4. **User Testing**: Recruit participants with relevant disabilities. Include variety (vision, motor, cognitive, hearing). Test with their own devices. Focus on real tasks.

### Test Matrix

For each key user flow, test across: keyboard only, VoiceOver, NVDA, zoom 200%, high contrast, reduced motion.

### WCAG Criteria Checklist

Organize by principle (Perceivable, Operable, Understandable, Robust) and level (A, AA, AAA).

### Reporting

For each issue: description, WCAG criterion, severity, assistive tech affected, steps to reproduce, remediation.

### Rules

- Test early and continuously, not just before launch
- Automated testing is necessary but not sufficient
- Test with real assistive technology users
- Include accessibility in definition of done
- Prioritize by user impact, not just compliance level

## Prototype Strategy

### Fidelity Spectrum

- **Low**: Paper sketches, sticky notes, rough wireframes. Best for early exploration, IA, flow validation. Fast, easy to discard.
- **Medium**: Digital wireframes, clickable prototypes, gray-box layouts. Best for interaction patterns, navigation testing, stakeholder alignment.
- **High**: Pixel-perfect mockups, coded prototypes, motion prototypes. Best for visual validation, micro-interaction testing, handoff, usability testing.

### Methods

- **Paper prototyping**: Sketch screens, manually swap on user action
- **Clickable wireframes**: Linked screens with hotspots
- **Interactive prototypes**: Stateful with real interactions
- **Coded prototypes**: HTML/CSS/JS for realistic behavior
- **Wizard of Oz**: Fake backend, real frontend
- **Video prototypes**: Walkthrough animations showing concept

### Choosing Fidelity

- What question are you answering?
- Who is the audience (users, stakeholders, developers)?
- How much time do you have?
- How many iterations expected?
- What decisions will this prototype inform?

### Rules

- Match fidelity to the question, not the deadline
- Prototype the riskiest assumption first
- Don't over-invest before testing
- Make it clear it is a prototype (avoid polish for early feedback)
- Plan for iteration -- build to throw away

## User Flow Diagrams

### Flow Elements

- **Entry point**: Where user enters (circle/oval)
- **Screen/page**: A view (rectangle)
- **Decision**: Branching point (diamond)
- **Action**: Something user does (rounded rectangle)
- **System process**: Backend operation (rectangle with side bars)
- **End point**: Flow completion (circle with border)
- **Connector**: Arrow showing direction

### Flow Types

- **Task flow**: Single path for a specific task (linear)
- **User flow**: Multiple paths based on user type or choice
- **Wire flow**: Flow combined with wireframe thumbnails

### Creation Process

1. Define the goal the flow accomplishes
2. Identify entry point(s)
3. Map happy path first
4. Add decision points and branches
5. Map error paths and recovery
6. Mark exit points
7. Note system actions in background

### Annotations

- Screen names and key content
- Decision criteria at each branch
- Error conditions and handling
- System events and notifications
- Time delays or async processes

### Rules

- One flow per user goal
- Start with happy path, then add complexity
- Include error and edge case paths
- Keep flows readable (limit branches per diagram)
- Use consistent notation
- Label every arrow with trigger/action

## Wireframe Specifications

### Components

- **Content Blocks**: Headers/nav, hero/feature areas, content sections, forms/inputs, footers
- **Annotations**: Content priority numbers, interaction notes, dynamic content indicators, responsive behavior, accessibility notes
- **Content Specs**: Heading hierarchy (H1-H3), approximate text length, image aspect ratios, required vs optional, content source (static, CMS, API)

### Fidelity Levels

- **Sketch**: Hand-drawn boxes and labels
- **Low-fi**: Gray boxes with content labels
- **Mid-fi**: Realistic layout with placeholder content
- **Annotated**: Mid-fi plus detailed behavior specs

### Conventions

- Use gray/black/white only (no color decisions)
- X-box for images
- Wavy lines for text blocks
- Real labels for navigation and buttons
- Consistent component representation

### Rules

- Focus on content hierarchy, not visual design
- Annotate behavior, not just layout
- Show multiple states (empty, loading, populated, error)
- Include responsive breakpoint versions
- Get content strategy input early
