# Design Ops

## Design Critique

### Framework

**Before**: Designer shares context (goals, constraints, audience, stage). Define what feedback is needed. Set rules: constructive, specific, actionable.

**During**:

1. **Present** (5 min) -- Designer walks through work and goals
2. **Clarify** (5 min) -- Questions to understand, not judge
3. **Feedback rounds** -- Structured by category or priority
4. **Discuss** -- Open conversation on key tensions
5. **Capture** -- Document decisions and action items

**After**: Designer summarizes takeaways. Action items with owners and deadlines. Follow-up review if needed.

### Feedback Format

- "I notice..." (observation, not judgment)
- "I wonder..." (question or exploration)
- "What if..." (suggestion or alternative)
- "I think... because..." (opinion with rationale)

### Critique Types

- **Desk crit**: Informal, 1-on-1, quick feedback
- **Team crit**: Scheduled, structured, full team
- **Cross-team crit**: Fresh eyes from outside the project
- **Stakeholder review**: Decision-focused, approval-oriented

### Pitfalls

- Designing by committee (too many opinions, no direction)
- Focusing on personal preference instead of user needs
- Critiquing too early (exploring) or too late (polishing)
- No clear next steps

### Rules

- Separate exploration critiques from refinement critiques
- Critique the work, not the person
- Tie feedback to goals and user needs
- Rotate the facilitator role
- Make critique a regular ritual, not an event

## Design Review Process

### Review Gates

**Gate 1 -- Concept Review**:

- Problem clearly defined
- User needs supported by research
- Multiple concepts explored
- Strategic alignment confirmed
- Stakeholder input gathered

**Gate 2 -- Design Review**:

- Visual design meets brand standards
- Interaction patterns consistent
- Responsive behavior defined
- Content strategy applied
- Design system components used

**Gate 3 -- Pre-Handoff Review**:

- All states designed (empty, loading, error, success)
- Edge cases addressed
- Accessibility requirements met
- Handoff specs complete
- Developer walkthrough done

**Gate 4 -- Implementation QA**:

- Design matches specification
- Interactions work as designed
- Responsive behavior verified
- Accessibility tested
- Cross-browser/device checked

### Review Criteria

- Does it solve the user problem?
- Is it consistent with the design system?
- Is it accessible (WCAG AA)?
- Are all states and edge cases covered?
- Is it feasible to implement?

### Approval Workflow

Designer self-review -> Peer design review -> Design lead sign-off -> Stakeholder approval (if required) -> Developer acceptance.

### Rules

- Not every project needs every gate
- Scale process to project size and risk
- Use checklists to make reviews objective
- Time-box reviews to prevent endless cycles
- Document review decisions and rationale

## Design QA Checklist

### Visual Accuracy

- Colors match design tokens
- Typography matches specified styles
- Spacing and sizing match specs
- Border radius, shadows, opacity correct
- Icons correct size and color
- Images correct aspect ratio and quality

### Layout

- Grid alignment correct
- Responsive behavior matches specs at each breakpoint
- Content reflows properly
- No unexpected overflow or clipping
- Min/max widths respected

### Interaction

- All states render correctly (default, hover, focus, active, disabled)
- Transitions and animations match specs
- Click/touch targets adequate (44px minimum)
- Keyboard navigation works in correct order
- Focus indicators visible

### Content

- Real content fits layout (no lorem ipsum in production)
- Truncation works as specified
- Empty states display correctly
- Error messages correct
- Loading states appear as designed

### Accessibility

- Screen reader announces correctly
- Color contrast meets WCAG AA
- Focus management works
- ARIA labels and roles correct
- Reduced motion respected

### Cross-Platform

- Required browsers supported
- Required devices supported
- Handles different text sizes (OS accessibility)
- Handles different screen densities

### QA Process

1. Developer self-review against checklist
2. Designer visual QA pass
3. File bugs with screenshots (design vs implementation)
4. Prioritize bugs by severity
5. Verify fixes

### Rules

- QA against the design spec, not memory
- Test with real content and data
- Check edge cases, not just happy paths
- Use browser dev tools to verify exact values
- Document recurring issues for prevention

## Team Workflow

### Task Management

- How work is tracked (boards, tickets, sprints)
- Status definitions (backlog, in progress, in review, done)
- Priority levels and assignment
- Capacity planning and workload balancing

### Collaboration Rituals

- **Standup** (daily/async): Current work, blockers
- **Design critique** (weekly): Structured feedback
- **Design review** (per milestone): Quality gates
- **Retrospective** (per sprint/month): Process improvement
- **Show and tell** (bi-weekly): Share with broader team

### Communication Norms

- Sync vs async decision criteria
- Response time expectations per channel
- How to request feedback
- How to share decisions and context
- Documentation requirements

### Tooling Stack

- Design (Figma, Sketch)
- Prototyping
- Project management (Jira, Linear, Asana)
- Communication (Slack, Teams)
- Documentation (Notion, Confluence)
- Version control and asset management

### Design-Development Collaboration

- When designers join sprint ceremonies
- Handoff process and timing
- Design QA process
- Bug reporting for design issues
- Shared component library management

### Workflow Stages

1. **Discovery**: Research and problem framing
2. **Exploration**: Concept generation and evaluation
3. **Refinement**: Detailed design and specification
4. **Handoff**: Developer delivery and support
5. **QA**: Implementation verification
6. **Iteration**: Post-launch improvement

### Rules

- Document the workflow and make it visible
- Review and adapt regularly
- Optimize for actual needs, not theory
- Balance structure with flexibility
- Automate repetitive tasks

## Design Sprint Plan

### 5-Day Structure

**Day 1 -- Understand**: Define challenge and sprint questions. Expert interviews and lightning talks. Map user journey. Choose target area.

**Day 2 -- Diverge**: Lightning demos of inspiration. Individual sketching (Crazy 8s, solution sketches). Silent critique and heat map voting. Decision on direction.

**Day 3 -- Decide**: Review solutions. Storyboard the prototype flow. Assign roles. Plan what to test.

**Day 4 -- Prototype**: Build a realistic facade. Divide and conquer (screens, content, flow). Stitch together and rehearse. Confirm test logistics.

**Day 5 -- Test**: 5 user interviews with prototype. Observe and take notes. Debrief after each session. Synthesize patterns and decide next steps.

### Variations

- **Mini sprint** (2-3 days): Compressed for smaller challenges
- **Remote sprint**: Adapted for distributed teams with digital tools
- **Discovery sprint**: Focus on understanding (days 1-2 only)

### Planning Checklist

- Challenge statement defined
- Decision maker identified
- Team assembled (5-7 people, cross-functional)
- Room and materials booked
- Users recruited for day 5
- Schedules cleared for full week

### Rules

- Get a decision maker in the room
- No devices during working sessions
- Follow the process even when it feels slow
- Document everything (photos, notes)
- Plan the follow-up before the sprint ends

## Developer Handoff

### Visual Specifications

- Spacing and sizing (token references, not raw pixels)
- Color values (token names, not hex codes)
- Typography (style name, size, weight, line-height)
- Border radius, shadows, opacity
- Responsive breakpoint behavior

### Interaction Specifications

- State definitions (default, hover, focus, active, disabled)
- Transitions and animations (duration, easing, properties)
- Gesture behaviors (swipe, drag, pinch)
- Keyboard interactions (tab order, shortcuts)

### Content Specifications

- Character limits and truncation behavior
- Dynamic content rules (min/max)
- Localization considerations (text expansion, RTL)
- Empty, loading, and error state content

### Asset Delivery

- Icons (SVG, named per convention)
- Images (resolution, format, responsive variants)
- Fonts (files or service links)
- Custom illustrations or graphics

### Edge Cases

- Min/max content scenarios
- Responsive behavior at each breakpoint
- Browser/device-specific considerations
- Accessibility requirements (ARIA, keyboard, screen reader)

### Implementation Notes

- Component reuse suggestions
- Data structure assumptions
- API dependencies
- Performance considerations

### Rules

- Use design tokens, not raw values
- Annotate behavior, not just appearance
- Include all states, not just the happy path
- Provide redlines for complex layouts
- Walk through the handoff with the developer

## Version Control Strategy

### What to Version

Design files, component libraries, design tokens, icon sets, documentation.

### Versioning Approaches

**Design Files**: Named versions at milestones (v1-exploration, v2-refinement, v3-final). Branch-based: main for approved, feature branches for WIP. Page-based: version history within the file.

**Component Libraries** (semver):

- **Major**: Breaking changes (renamed components, removed props)
- **Minor**: New components or features (backward compatible)
- **Patch**: Bug fixes and refinements

**Design Tokens**: Version alongside component library. Changelog for additions, changes, removals. Migration guides for breaking changes.

### Branching Strategy

- Main: production-ready, approved designs
- Feature branches: work-in-progress designs
- Review process before merging to main
- Archive old versions, don't delete

### Changelog Practices

- Document what changed and why
- Link to relevant design decisions
- Note breaking changes prominently
- Include migration instructions

### Rules

- Version at meaningful milestones, not every save
- Name versions descriptively
- Keep a changelog
- Communicate changes to consumers
- Archive rather than delete
