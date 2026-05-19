# Research Methods Reference

## Interview Scripts

Structure every interview using the funnel approach: broad context before specific features.

### Script Sections

| Section | Duration | Purpose |
| --------- | ---------- | --------- |
| Introduction | 2-3 min | Welcome, explain purpose, set expectations, get consent |
| Warm-up | 3-5 min | Easy context-setting questions about background and role |
| Core exploration | 20-30 min | Deep-dive questions organized by research theme, with follow-up probes |
| Specific scenarios | 10-15 min | Walk-through of specific tasks or experiences |
| Wrap-up | 3-5 min | Summary, anything missed, next steps, thank you |

### Question Principles

- Use JTBD probing: "When did you last...?" "What were you trying to accomplish?" "What happened next?"
- Avoid leading questions, hypotheticals, and yes/no questions
- Follow-up with: "Tell me more about that", "Why was that important?", "What happened next?"

### Facilitator Notes

- Stay neutral in tone and body language
- Redirect tangents gently: "That's interesting -- I'd love to come back to that. Earlier you mentioned..."
- Track time per section; protect the wrap-up

---

## Interview Summarization

After each interview, produce a structured summary with these sections:

1. **Participant profile** -- role, context, experience level
2. **Key themes** (3-5) -- with supporting verbatim quotes
3. **Jobs-to-be-done** -- what the participant is trying to accomplish
4. **Pain points** -- frustrations and barriers, rated by severity
5. **Workarounds** -- how they currently solve problems
6. **Delighters** -- what works well or exceeds expectations
7. **Notable quotes** (5-8) -- verbatim, capturing key insights
8. **Surprises** -- anything counter to assumptions
9. **Action items** -- specific design or research follow-ups

For each insight, note whether it was explicitly stated or inferred.

---

## User Personas

Build personas from behavioral patterns, not demographics alone (Alan Cooper, About Face).

### Per Persona, Include

- Name, photo description, one-line quote capturing mindset
- Demographics: age range, occupation, tech comfort, relevant context
- Goals: functional, emotional, social
- Frustrations: current pain points and unmet needs
- Behaviors: how they currently approach the problem
- Scenario: brief day-in-the-life narrative
- Design implications: what this means for product decisions

### Process

1. Identify behavioral patterns from research data -- find clusters of behaviors, motivations, needs
2. Define 2-4 personas
3. Designate one primary persona (the one the design must satisfy first) and explain why
4. Highlight research gaps that would strengthen the personas

---

## Empathy Maps

Four-quadrant model (Dave Gray, XPLANE) for externalizing team understanding of a user type.

### Quadrants

| Quadrant | Content | Source |
| ---------- | --------- | -------- |
| **Says** | Direct quotes and statements | Verbatim from research |
| **Thinks** | Beliefs, concerns, assumptions | Inferred from behavior and context |
| **Does** | Observable actions, behaviors, workarounds | Observed or reported |
| **Feels** | Emotional states, anxieties, motivations | Inferred from tone, context |

### Also Capture

- **Goals** -- what the user is trying to achieve
- **Pain points** -- barriers, frustrations, unmet needs

### Outputs

- Design implications emerging from the map
- Gaps: what do we still need to learn?

---

## Journey Maps

Visualize end-to-end experience across stages, touchpoints, channels, emotions, and pain points (Jim Kalbach, Mapping Experiences).

### Process

1. Clarify scope: persona, scenario, start/end boundaries
2. Define 5-7 stages (awareness through post-use/advocacy)
3. Map each stage:
   - User goals
   - Actions and behaviors
   - Touchpoints and channels
   - Thoughts and questions
   - Emotional state (positive/negative scale)
   - Pain points and friction
   - Opportunity areas
4. Visualize the emotional curve across stages
5. Prioritize top 3-5 design opportunities by impact and feasibility
6. Identify moments of truth -- the critical make-or-break moments

Make journey maps persona-specific. Map current state (as-is) and highlight future-state opportunities.

---

## Jobs-to-Be-Done

People hire products to get a job done. Focus on the job, not the product (Christensen, Ulwick).

### Job Statement Format
>
> When [situation], I want to [motivation], so I can [expected outcome].

### Three Dimensions

- **Functional** -- the practical task or outcome
- **Emotional** -- the feeling sought or avoided
- **Social** -- how they want to be perceived

### Job Lifecycle Stages

Define, locate, prepare, confirm, execute, monitor, modify, conclude.

### Mapping Process

1. Identify the core job
2. Map all three dimensions
3. Define job stages
4. Identify outcome expectations for each dimension
5. Map current solutions ("What do users currently hire for this job?")
6. Find underserved areas where current solutions fall short

---

## Diary Studies

Capture longitudinal behavior in natural context over time.

### Study Design Checklist

- [ ] **Duration**: 1-4 weeks typical
- [ ] **Participants**: 8-15, with screening criteria and compensation plan
- [ ] **Entry prompts**: daily or event-triggered; mix structured and open-ended
- [ ] **Capture methods**: photo, video, text, voice -- specify what to document
- [ ] **Check-in schedule**: mid-study interviews or pulse surveys
- [ ] **Onboarding**: participant briefing, practice entries, tool setup
- [ ] **Attrition plan**: strategies to keep participants engaged

### Analysis Framework

Define upfront how to code, theme, and synthesize entries across participants.

---

## Affinity Diagrams

Synthesize large amounts of qualitative data into themed clusters.

### Process

1. **Extract** individual observations, quotes, and notes from raw data
2. **Cluster bottom-up** -- group related data points into natural clusters (do NOT start with predefined categories)
3. **Name each cluster** with a descriptive theme label capturing the group's essence
4. **Create hierarchy** -- organize into 3-5 top-level themes
5. **Write insight statements** for each theme ("so what?")
6. **Identify patterns** -- note frequency, intensity, connections between themes
7. **Prioritize** by impact on design decisions

### Output Format

Structured hierarchy with insight statements and supporting evidence per theme.

---

## Card Sort Analysis

Analyze card sorting results to inform information architecture.

### Pre-Analysis

- Confirm methodology: open vs. closed sort
- Note participant count and card set

### Analysis Steps

1. Identify common category patterns and naming conventions
2. Create a similarity matrix showing how frequently items were grouped together
3. Flag ambiguous items -- cards that were inconsistently categorized
4. Recommend IA structure based on user mental models

### Next Steps

- Tree testing to validate proposed structure
- Additional research for ambiguous areas
- Design iteration on navigation and content organization

---

## Method Selection Guide

| Goal | Method |
| ------ | -------- |
| Understand motivations and mental models | Interview script |
| Capture behavior over time in context | Diary study |
| Synthesize qualitative data at scale | Affinity diagram |
| Define archetypical users for design | Persona |
| Quick team alignment on user understanding | Empathy map |
| Map full experience across touchpoints | Journey map |
| Reframe around user motivation, not features | JTBD |
| Validate information architecture | Card sort |
| Extract actionable findings from a session | Interview summary |

---

## Key References

- Interviewing Users -- Steve Portigal
- About Face -- Alan Cooper
- Mapping Experiences -- Jim Kalbach
- Gamestorming -- Dave Gray
- Just Enough Research -- Erika Hall
- Lean UX -- Jeff Gothelf & Josh Seiden
- The Elements of User Experience -- Jesse James Garrett
