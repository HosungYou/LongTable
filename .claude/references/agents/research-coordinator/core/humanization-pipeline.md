---
name: humanization-pipeline
version: "3.0.0"
description: |
  Humanization Pipeline v3.0 - 4-Layer multi-pass iterative architecture integrating
  AI pattern detection and transformation into the Research Coordinator workflow.
  Connects G5 (Auditor v3.0), G6 (Humanizer v3.0), and F5 (Verifier v3.0) with existing
  writing agents. Features 3+1 pass pipeline (vocabulary/structure/discourse/polish),
  section-aware mode escalation, 13 quantitative metrics, DT1-DT4 discourse strategies,
  perturbation naturalization, and human checkpoints between passes.
  Orchestrated by /diverga:humanize skill.
---

# Humanization Pipeline v3.0

## Overview

The Humanization Pipeline provides an optional but recommended step for all AI-generated academic text. It integrates seamlessly with existing Research Coordinator workflows to help researchers produce natural, authentic writing while maintaining academic integrity.

**v3.0 upgrades**: 4-layer multi-pass architecture with discourse-level transformation. Pass 1 (Layer 1-2: vocabulary/phrase), Pass 2 (Layer 3: structure), Pass 3 (Layer 4: discourse DT1-DT4), Pass 4 (optional: polish). G5 v3.0 with 28 patterns across 7 domains (D1-D4 discourse), 13 quantitative metrics, 6-component composite scoring. F5 v3.0 with 8 verification domains (Domain 8: Discourse Naturalness). Perturbation naturalization for human-like edit patterns. Orchestrated by `/diverga:humanize` skill.

**Reference Documentation**: https://github.com/HosungYou/humanizer

---

## Pipeline Architecture

```
+-----------------------------------------------------------------------------+
|                     HUMANIZATION PIPELINE v3.0                               |
|                     (4-Layer Multi-Pass Architecture)                        |
+-----------------------------------------------------------------------------+
|                                                                              |
|  +-----------------------------------------------------------------------+  |
|  |  STAGE 1: CONTENT GENERATION                                          |  |
|  |  +----------------+  +----------------+  +----------------+           |  |
|  |  |     G2         |  |     G3         |  |  Auto-Doc      |           |  |
|  |  |  Academic      |  |    Peer        |  |   System       |           |  |
|  |  | Communicator   |  |   Review       |  |                |           |  |
|  |  +-------+--------+  +-------+--------+  +-------+--------+           |  |
|  |          |                    |                    |                    |  |
|  |          +--------------------+--------------------+                    |  |
|  |                               |                                        |  |
|  +-------------------------------+----------------------------------------+  |
|                                  |                                           |
|  +-------------------------------v----------------------------------------+  |
|  |  STAGE 2: INITIAL ANALYSIS                                             |  |
|  |                               v                                        |  |
|  |           +----------------------------------+                         |  |
|  |           |   G5-AcademicStyleAuditor v3.0   |                         |  |
|  |           |  +----------------------------+  |                         |  |
|  |           |  | - Pattern Detection (28,   |  |                         |  |
|  |           |  |   7 domains, D1-D4)        |  |                         |  |
|  |           |  | - 13 Quantitative Metrics  |  |                         |  |
|  |           |  | - v3.0 Composite (6 comp)  |  |                         |  |
|  |           |  | - Risk Classification       |  |                         |  |
|  |           |  | - AI Probability Score      |  |                         |  |
|  |           |  | - Section-Level Scores      |  |                         |  |
|  |           |  +----------------------------+  |                         |  |
|  |           +---------------+------------------+                         |  |
|  |                           |                                            |  |
|  |                           v                                            |  |
|  |  +-------------------------------------------------------------+      |  |
|  |  |  CHECKPOINT: CP_HUMANIZATION_REVIEW                          |      |  |
|  |  |                                                              |      |  |
|  |  |  "AI patterns detected. Would you like to humanize?"         |      |  |
|  |  |                                                              |      |  |
|  |  |  [A] Conservative  [B] Balanced (star)  [C] Aggressive       |      |  |
|  |  |  [D] View Report   [E] Skip                                  |      |  |
|  |  +-------------------------------------------------------------+      |  |
|  +-------------------------------+----------------------------------------+  |
|                                  |                                           |
|                         +--------+--------+                                  |
|                         |                 |                                  |
|                  User selects          User selects                          |
|                    mode                 "Skip"                               |
|                         |                 |                                  |
|                         v                 |                                  |
|  +=======================================================================+  |
|  ||  STAGE 3: MULTI-PASS TRANSFORMATION                                 ||  |
|  ||                                                                      ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||  | PASS 1: VOCABULARY PASS (Conservative)                         | ||  |
|  ||  |   G5 Scan (full) --> G6 (L1, M1, C1) --> F5 Quick Verify      | ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||                          |                                           ||  |
|  ||                          v                                           ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||  | CP_PASS1_REVIEW                                                | ||  |
|  ||  | "Score dropped from X% to Y%. Continue to structural pass?"    | ||  |
|  ||  | [A] Continue  [B] Accept  [C] View diff                        | ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||                          |                                           ||  |
|  ||                          v                                           ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||  | PASS 2: STRUCTURAL PASS (Balanced)                             | ||  |
|  ||  |   G5 Scan (delta) --> G6 (S7-S10, CV enhancement)             | ||  |
|  ||  |   --> F5 Full Verify                                           | ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||                          |                                           ||  |
|  ||                          v                                           ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||  | CP_PASS2_REVIEW                                                | ||  |
|  ||  | "Score now Z%. Continue to discourse pass?"                    | ||  |
|  ||  | [A] Continue  [B] Accept  [C] Manual review                    | ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||                          |                                           ||  |
|  ||                          v                                           ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||  | PASS 3: DISCOURSE PASS (Layer 4, DT1-DT4)                     | ||  |
|  ||  |   G5 Scan (delta) --> G6 (DT1-DT4) --> F5 Full Verify        | ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||                          |                                           ||  |
|  ||                          v                                           ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||  | CP_PASS3_REVIEW                                                | ||  |
|  ||  | "Score now W%. Target met?"                                    | ||  |
|  ||  | [A] Accept  [B] One more pass  [C] Manual review               | ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||                          |                                           ||  |
|  ||                     (if B selected)                                   ||  |
|  ||                          v                                           ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||  | PASS 4 (Optional): POLISH PASS                                 | ||  |
|  ||  |   G5 Scan (audit) --> G6 micro fixes --> F5 Full Verify        | ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||                          |                                           ||  |
|  ||                          v                                           ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||  | CP_FINAL_REVIEW: Final approval                                | ||  |
|  ||  +----------------------------------------------------------------+ ||  |
|  ||                                                                      ||  |
|  +=======================================================================+  |
|                                  |                                           |
|                                  v                                           |
|  +-----------------------------------------------------------------------+  |
|  |  STAGE 4: OUTPUT                                                       |  |
|  |  +----------------+  +----------------+  +----------------+            |  |
|  |  |   Word         |  |  PDF           |  |  Other         |            |  |
|  |  |  Export         |  | Export         |  | Formats        |            |  |
|  |  +----------------+  +----------------+  +----------------+            |  |
|  |                                                                        |  |
|  |  + Optional: AI Pattern Report Appendix                               |  |
|  |  + Optional: Transformation Audit Trail                               |  |
|  |  + Optional: Score Progression Report                                 |  |
|  +-----------------------------------------------------------------------+  |
|                                                                              |
+------------------------------------------------------------------------------+
```

---

## Multi-Pass Architecture

### Design Principles

The multi-pass architecture replaces the v1.0 single-pass pipeline based on empirical evidence from humanizing two academic papers (Paper 1: TFSC, Paper 2: IJAIED). The single-pass approach required 3 manual rounds to achieve acceptable scores (80% -> 62% -> 31%). The multi-pass architecture automates this progression.

### Pass Definitions

**Pass 1: VOCABULARY PASS (Conservative)**
- **Target**: Word-level and phrase-level AI patterns
- **G5 Scan**: Full scan — establishes baseline score and identifies all patterns
- **G6 Transformation**: L1 vocabulary (Tier 1 + Tier 2), M1 meta-commentary, C1 significance inflation
- **F5 Verification**: Quick verify — citation integrity and statistical accuracy only
- **Expected reduction**: 15-25 percentage points
- **Checkpoint**: CP_PASS1_REVIEW — presents score before/after, patterns remaining, burstiness CV

**Pass 2: STRUCTURAL PASS (Balanced)**
- **Target**: Structural patterns and sentence-level rhythm
- **G5 Scan**: Delta scan — measures improvement from Pass 1, identifies remaining structural patterns
- **G6 Transformation**: S7 enumeration dissolution, S8 paragraph opener variation, S9 discussion architecture, S10 hypothesis narrative, burstiness CV enhancement
- **F5 Verification**: Full verify — all 8 verification domains
- **Expected reduction**: 10-20 additional percentage points
- **Checkpoint**: CP_PASS2_REVIEW — presents score progression (original -> Pass 1 -> Pass 2), structural metrics (burstiness CV, MTLD)

**Pass 3: DISCOURSE PASS (Layer 4, DT1-DT4)**
- **Target**: Discourse-level AI patterns (D1-D4 domains)
- **G5 Scan**: Delta scan — measures improvement from Pass 2, identifies remaining discourse patterns
- **G6 Transformation**: DT1 (discourse marker naturalization), DT2 (paragraph transition variation), DT3 (argument flow restructuring), DT4 (rhetorical stance diversification)
- **F5 Verification**: Full verify — all 8 verification domains (including Domain 8: Discourse Naturalness)
- **Expected reduction**: 5-15 additional percentage points
- **Checkpoint**: CP_PASS3_REVIEW — presents score progression (original -> Pass 1 -> Pass 2 -> Pass 3), discourse metrics, perturbation naturalization stats

**Pass 4 (Optional): POLISH PASS**
- **Target**: Remaining micro-patterns and fine-tuning
- **G5 Scan**: Audit scan — comprehensive final check
- **G6 Transformation**: Micro fixes only — remaining hedging, paragraph opener diversity, sentence length outliers
- **F5 Verification**: Full verify — all 8 verification domains
- **Expected reduction**: 5-10 additional percentage points
- **Checkpoint**: CP_FINAL_REVIEW — presents complete score history, full diff report, F5 verification summary
- **Trigger**: Only if score target not yet met after Pass 3

### Pass Execution Rules

```yaml
max_passes: 4
diminishing_returns_threshold: 5  # Stop if pass reduces less than 5 percentage points
pass_3_default: true  # Discourse pass runs by default in balanced/aggressive modes
pass_4_trigger: "score_target_not_met OR user_requested"
between_pass_rescan: true  # MANDATORY G5 re-scan between every pass
checkpoint_between_passes: true  # Human checkpoint between every pass
```

---

## Section-Aware Mode Escalation

### Overview

Instead of applying a single mode to the entire document, the pipeline automatically selects the appropriate transformation intensity per section based on G5 section-level scores.

### Escalation Rules

```yaml
section_aware_escalation:
  abstract:     conservative -> balanced (section_score > 50)
  introduction: balanced -> balanced (no escalation)
  methods:      conservative -> conservative (never escalate)
  results:      conservative -> balanced (section_score > 60)
  discussion:   balanced -> aggressive (section_score > 50)
  conclusion:   balanced -> aggressive (section_score > 50)
```

### Rationale

| Section | Default Mode | Escalation | Why |
|---------|-------------|------------|-----|
| Abstract | Conservative | To balanced at >50 | Highest scrutiny from reviewers; minimal changes preferred |
| Introduction | Balanced | No escalation | Moderate changes acceptable; maintains author's framing |
| Methods | Conservative | Never | Boilerplate expected; changes risk accuracy |
| Results | Conservative | To balanced at >60 | Statistics must be preserved; only framing language changes |
| Discussion | Balanced | To aggressive at >50 | Benefits most from structural transformation; author voice matters |
| Conclusion | Balanced | To aggressive at >50 | Final impression matters; can tolerate more stylistic changes |

### Override

Users can override section-aware escalation with a global mode:
```
"Humanize my draft (force: conservative)"  # Conservative for all sections
"Humanize my draft (force: aggressive)"    # Aggressive for all sections
```

---

## Post-Transformation G5 Re-Scan

### MANDATORY Rule

**After every G6 transformation pass, G5 MUST re-scan the transformed text.** This is non-negotiable because G6 can introduce NEW AI patterns while fixing old ones (empirically observed during Round 3 humanization).

### Re-Scan Protocol

```yaml
post_transformation_audit:
  trigger: "After every G6 transformation pass"
  agent: "G5-AcademicStyleAuditor"
  scan_type:
    after_pass_1: "delta"   # Compare to original, focus on changes
    after_pass_2: "delta"   # Compare to Pass 1 output
    after_pass_3: "delta"   # Compare to Pass 2 output, focus on discourse
    after_pass_4: "full"    # Comprehensive audit of final output

  checks:
    - "No new HIGH-RISK patterns introduced"
    - "No new pattern categories activated"
    - "Overall score decreased (not increased)"
    - "Burstiness CV did not decrease"
    - "MTLD did not significantly decrease"

  on_new_patterns_found:
    action: "FLAG to user"
    message: "G6 introduced {N} new patterns while removing {M}. Net change: {delta}"
    options:
      - "[A] Accept (net improvement)"
      - "[B] Revert this pass"
      - "[C] Target new patterns in next pass"

  on_score_increase:
    action: "WARN"
    message: "Score INCREASED from {before}% to {after}%. Transformation may have introduced AI-typical structures."
    options:
      - "[A] Revert this pass"
      - "[B] Continue anyway"
```

---

## Score Target System

### Overview

Users can specify a target AI probability score instead of manually selecting modes. The pipeline automatically selects modes and runs passes until the target is met or the 4-pass limit is reached.

### Configuration

```yaml
target_mode:
  enabled: true
  usage: '"Humanize to target: 30%"'
  behavior:
    - Run G5 to get baseline score
    - Calculate required reduction
    - Auto-select mode per section to meet target (using section-aware escalation)
    - Run iterative passes until target met or 3-pass limit reached
    - Report final score vs target

  presets:
    "journal_safe": 30    # Target for peer-reviewed journals
    "conference": 40      # Target for conference papers
    "working_paper": 50   # Target for working papers/preprints

  commands:
    - '"Humanize to target: 30%"'
    - '"Humanize (journal_safe)"'
    - '"Humanize (conference)"'
    - '"Humanize (working_paper)"'
```

### Target Behavior

```
IF baseline_score <= target:
    SKIP humanization ("Already below target")

IF baseline_score - target <= 25:
    PLAN: 1-2 passes (vocabulary may suffice)

IF baseline_score - target > 25:
    PLAN: 2-4 passes (structural + discourse transformation likely needed)

AFTER each pass:
    IF current_score <= target:
        STOP ("Target met")
    IF pass_reduction < 5:
        STOP ("Diminishing returns — manual review recommended")
```

---

## Integration Points

### With G2-AcademicCommunicator

When G2 generates content:

```yaml
trigger: "After G2 generates any output"
condition: "humanization_enabled: true (default)"

workflow:
  1. G2 generates content (abstract, summary, etc.)
  2. Auto-invoke G5 for pattern analysis
  3. Present CP_HUMANIZATION_REVIEW
  4. If user approves -> invoke multi-pass pipeline
  5. Run passes with inter-pass checkpoints
  6. Output final version

commands:
  - "Generate abstract with humanization"
  - "Create summary (humanize: balanced)"
  - "Write press release (skip humanization)"
```

### With G3-PeerReviewStrategist

When G3 generates response letters:

```yaml
trigger: "After G3 generates response letter"
condition: "humanization_enabled: true"

special_rules:
  - Preserve professional gratitude phrases
  - Keep reviewer reference numbers
  - Maintain point-by-point structure
  - Focus on language/vocabulary patterns
  - Limit to Pass 1 (vocabulary only) for response letters

workflow:
  1. G3 generates response letter
  2. G5 analysis with "response_letter" context
  3. Checkpoint with response-specific options
  4. G6 transformation (preserves structure)
  5. F5 verification
```

### With Auto-Documentation System

When exporting documents:

```yaml
trigger: "Export to Word/PDF/etc."
condition: "humanization_before_export: true"

workflow:
  1. Auto-doc prepares content
  2. G5 analyzes (section-aware)
  3. Checkpoint before export
  4. If approved -> run multi-pass pipeline
  5. F5 verifies after each pass
  6. Export with humanized content

export_options:
  - "Export methods (with humanization)"
  - "Export manuscript (humanize: conservative)"
  - "Export draft (raw, no humanization)"
  - "Export manuscript (humanize to target: 30%)"
```

---

## Configuration

### Pipeline Settings

```yaml
# .research/humanization-config.yaml

humanization:
  enabled: true                    # Master switch
  default_mode: "balanced"         # conservative/balanced/aggressive
  pipeline_version: "3.0"         # 4-layer multi-pass iterative pipeline

  auto_check: true                 # Auto-run G5 on exports
  show_checkpoint: true            # Show CP_HUMANIZATION_REVIEW
  require_verification: false      # Require F5 before export

  # Multi-pass settings (v3.0)
  multi_pass:
    max_passes: 4
    inter_pass_checkpoint: true    # Show checkpoint between passes
    auto_stop_threshold: 5         # Stop if pass reduces < 5 percentage points
    mandatory_rescan: true         # G5 re-scan after every pass

  # Score target settings (v3.0)
  score_target:
    enabled: true
    default_target: null           # No default — user specifies
    presets:
      journal_safe: 30
      conference: 40
      working_paper: 50

  # Section-aware escalation (v3.0)
  section_escalation:
    enabled: true
    allow_override: true           # Users can force global mode

  thresholds:
    skip_if_below: 20              # Skip if AI probability < 20%
    recommend_if_above: 40         # Recommend if > 40%
    require_if_above: 70           # Require review if > 70%

  reports:
    include_pattern_report: false  # Add to exports
    include_audit_trail: true      # Keep transformation log
    include_score_progression: true # v3.0: Show score across passes
    save_original: true            # Keep pre-humanization version

  ethics:
    show_disclosure_reminder: true
    suggest_acknowledgment: true
```

### Section-Specific Settings

```yaml
sections:
  abstract:
    mode: "conservative"
    strict_preservation: true
    escalation: "balanced at >50"

  methods:
    mode: "conservative"
    allow_boilerplate: true
    escalation: "never"

  results:
    mode: "conservative"
    preserve_all_statistics: true
    escalation: "balanced at >60"

  discussion:
    mode: "balanced"
    allow_more_changes: true
    escalation: "aggressive at >50"

  conclusion:
    mode: "balanced"
    escalation: "aggressive at >50"

  response_letter:
    mode: "balanced"
    preserve_gratitude: true
    preserve_structure: true
    max_passes: 1  # Vocabulary pass only
```

---

## Commands Reference

### Analysis Commands

```
"Check AI patterns"
-> Run G5 analysis only, show report

"Quick AI check"
-> Summary only (score + pattern count)

"Detailed pattern analysis"
-> Full G5 report with all patterns (28 patterns, 7 domains, D1-D4 discourse)

"Show flagged vocabulary"
-> List all AI-typical words found

"Show quantitative metrics"
-> Display all 13 metrics: burstiness CV, MTLD, sentence length range, opener diversity, hapax rate, contraction density, paragraph length variance, surprisal proxy, surprisal autocorrelation, connective diversity, pronoun density, question ratio, abstract noun ratio
```

### Transformation Commands

```
"Humanize my draft"
-> Full multi-pass pipeline with balanced mode

"Humanize (conservative)"
-> Pipeline with conservative mode

"Humanize (aggressive)"
-> Pipeline with aggressive mode

"Humanize section: methods"
-> Section-specific humanization

"Humanize to target: 30%"
-> Target-based multi-pass pipeline

"Humanize (journal_safe)"
-> Preset target: 30%

"Humanize (conference)"
-> Preset target: 40%

"Humanize (working_paper)"
-> Preset target: 50%

"Humanize (multi-pass)"
-> Explicit multi-pass with all checkpoints
```

### Export Commands

```
"Export with humanization"
-> Export after full pipeline

"Export to Word (humanize: balanced)"
-> Word export with balanced mode

"Export raw (no humanization)"
-> Export without pipeline

"Export with AI report"
-> Include pattern analysis in appendix

"Export with score progression"
-> Include pass-by-pass score report
```

### Utility Commands

```
"Compare original and humanized"
-> Side-by-side diff view

"Revert to original"
-> Undo humanization

"Show transformation log"
-> View all changes made

"Show score progression"
-> Display scores across all passes

"Configure humanization"
-> Adjust pipeline settings
```

---

## Checkpoints

### CP_HUMANIZATION_REVIEW (Recommended)

**When:** After G5 analysis, before transformation

**Presents:**
- AI probability score
- Pattern summary (high/medium/low counts)
- Quantitative metrics (burstiness CV, MTLD)
- Recommended mode
- User options

**Options:**
```
[A] Humanize (Conservative) - High-risk only
[B] Humanize (Balanced) (star) - Recommended
[C] Humanize (Aggressive) - Maximum
[D] View detailed report
[E] Skip humanization
```

### CP_PASS1_REVIEW (Recommended)

**When:** After Pass 1 (vocabulary), before Pass 2 (structural)

**Presents:**
- Score before/after Pass 1
- Patterns remaining (by category)
- Burstiness CV score
- Estimated improvement from structural pass

**Options:**
```
[A] Continue to structural pass
[B] Accept current state
[C] View detailed diff
```

### CP_PASS2_REVIEW (Recommended)

**When:** After Pass 2 (structural), before Pass 3 (discourse)

**Presents:**
- Score progression (original -> Pass 1 -> Pass 2)
- Structural metrics (burstiness CV, MTLD)
- Remaining pattern count
- Whether target is met (if target mode)

**Options:**
```
[A] Continue to discourse pass
[B] Accept current state
[C] Manual review mode
```

### CP_PASS3_REVIEW (Recommended)

**When:** After Pass 3 (discourse), before optional Pass 4 (polish)

**Presents:**
- Score progression (original -> Pass 1 -> Pass 2 -> Pass 3)
- Discourse metrics (DT1-DT4 pattern counts, perturbation stats)
- Remaining pattern count by domain
- Whether target is met (if target mode)

**Options:**
```
[A] Accept
[B] One more polish pass
[C] Manual review mode
```

### CP_FINAL_REVIEW (Optional)

**When:** After Pass 4 (polish), before export

**Presents:**
- Complete score history (all passes including discourse)
- Full diff report (original vs final)
- F5 verification summary (all 8 domains)
- Target compliance (if target mode)

**Options:**
```
[A] Approve and export
[B] Adjust specific changes
[C] Revert to earlier pass
[D] Revert to original
```

### CP_HUMANIZATION_VERIFY (Optional)

**When:** After any pass completes, if user requests detailed review

**Presents:**
- Before/after comparison for the specific pass
- Change summary
- New AI probability
- Integrity verification results

**Options:**
```
[A] Approve and continue
[B] Adjust specific changes
[C] Try different mode
[D] Revert to original
```

---

## Pipeline States

```yaml
states:
  idle:
    description: "No humanization in progress"
    transitions: [analyzing]

  analyzing:
    description: "G5 running pattern detection (initial scan)"
    agent: "G5-AcademicStyleAuditor"
    transitions: [awaiting_decision, idle]

  awaiting_decision:
    description: "Checkpoint presented, waiting for user"
    checkpoint: "CP_HUMANIZATION_REVIEW"
    transitions: [pass1_transforming, idle]

  pass1_transforming:
    description: "Pass 1: G6 applying vocabulary transformations"
    agent: "G6-AcademicStyleHumanizer"
    pass: 1
    layer: "vocabulary"
    transitions: [pass1_rescanning]

  pass1_rescanning:
    description: "G5 re-scanning after Pass 1"
    agent: "G5-AcademicStyleAuditor"
    transitions: [pass1_verifying]

  pass1_verifying:
    description: "F5 quick verify after Pass 1"
    agent: "F5-HumanizationVerifier"
    transitions: [awaiting_pass1_review]

  awaiting_pass1_review:
    description: "Pass 1 complete, awaiting user decision"
    checkpoint: "CP_PASS1_REVIEW"
    transitions: [pass2_transforming, complete]

  pass2_transforming:
    description: "Pass 2: G6 applying structural transformations"
    agent: "G6-AcademicStyleHumanizer"
    pass: 2
    layer: "structural"
    transitions: [pass2_rescanning]

  pass2_rescanning:
    description: "G5 re-scanning after Pass 2"
    agent: "G5-AcademicStyleAuditor"
    transitions: [pass2_verifying]

  pass2_verifying:
    description: "F5 full verify after Pass 2"
    agent: "F5-HumanizationVerifier"
    transitions: [awaiting_pass2_review]

  awaiting_pass2_review:
    description: "Pass 2 complete, awaiting user decision"
    checkpoint: "CP_PASS2_REVIEW"
    transitions: [pass3_transforming, complete]

  pass3_transforming:
    description: "Pass 3: G6 applying discourse transformations (DT1-DT4)"
    agent: "G6-AcademicStyleHumanizer"
    pass: 3
    layer: "discourse"
    transitions: [pass3_rescanning]

  pass3_rescanning:
    description: "G5 re-scanning after Pass 3 (discourse)"
    agent: "G5-AcademicStyleAuditor"
    transitions: [pass3_verifying]

  pass3_verifying:
    description: "F5 full verify after Pass 3 (discourse)"
    agent: "F5-HumanizationVerifier"
    transitions: [awaiting_pass3_review]

  awaiting_pass3_review:
    description: "Pass 3 complete, awaiting user decision"
    checkpoint: "CP_PASS3_REVIEW"
    transitions: [pass4_transforming, complete]

  pass4_transforming:
    description: "Pass 4: G6 applying polish transformations"
    agent: "G6-AcademicStyleHumanizer"
    pass: 4
    layer: "polish"
    transitions: [pass4_rescanning]

  pass4_rescanning:
    description: "G5 final audit scan after Pass 4"
    agent: "G5-AcademicStyleAuditor"
    transitions: [pass4_verifying]

  pass4_verifying:
    description: "F5 full verify after Pass 4"
    agent: "F5-HumanizationVerifier"
    transitions: [awaiting_final_review]

  awaiting_final_review:
    description: "Final review checkpoint"
    checkpoint: "CP_FINAL_REVIEW"
    transitions: [complete, pass3_transforming, idle]

  complete:
    description: "Pipeline finished, ready for export"
    transitions: [idle]
```

---

## Error Handling

### Transformation Failures

```yaml
on_error:
  citation_modified:
    action: "ABORT"
    message: "Citation integrity violated. Reverting."
    log: true

  statistics_modified:
    action: "ABORT"
    message: "Statistical values changed. Reverting."
    log: true

  meaning_distorted:
    action: "FLAG"
    message: "Possible meaning change detected."
    require_review: true

  mode_inappropriate:
    action: "SUGGEST"
    message: "Consider different mode for this section."
    offer_alternatives: true

  score_increased:
    action: "WARN"
    message: "AI score increased after transformation. G6 may have introduced new patterns."
    offer_revert: true

  new_patterns_introduced:
    action: "FLAG"
    message: "G6 introduced new AI patterns while removing old ones."
    present_net_change: true
```

### Recovery Options

```
"Revert humanization"
-> Return to original text

"Revert to Pass N"
-> Return to output of specific pass

"Undo last transformation"
-> Undo most recent change

"Reset pipeline"
-> Clear all state, start fresh
```

---

## Logging and Audit

### Transformation Log

```yaml
# .research/humanization-log.yaml

sessions:
  - session_id: "H001"
    timestamp: "2024-10-14T10:30:00Z"
    source: "G2-generated abstract"
    pipeline_version: "3.0"

    g5_initial_analysis:
      ai_probability: 67%
      patterns_detected: 18
      high_risk: 5
      medium_risk: 9
      low_risk: 4
      burstiness_cv: 0.28
      mtld: 52

    user_decision:
      checkpoint: "CP_HUMANIZATION_REVIEW"
      selected: "balanced"
      target: 30
      timestamp: "2024-10-14T10:31:00Z"

    pass_1:
      mode: "conservative"
      layer: "vocabulary"
      changes_made: 12
      g5_rescan:
        ai_probability: 48%
        new_patterns: 0
        burstiness_cv: 0.30
      f5_quick_verify:
        citation_integrity: true
        statistics_accuracy: true
      user_decision:
        checkpoint: "CP_PASS1_REVIEW"
        selected: "continue"

    pass_2:
      mode: "balanced"
      layer: "structural"
      changes_made: 8
      g5_rescan:
        ai_probability: 28%
        new_patterns: 1
        burstiness_cv: 0.48
        mtld: 74
      f5_full_verify:
        citation_integrity: true
        statistics_accuracy: true
        meaning_preserved: true
        burstiness_check: "PASS"
        structural_check: "PASS"
      user_decision:
        checkpoint: "CP_PASS2_REVIEW"
        selected: "accept"

    final:
      ai_probability: 28%
      total_passes: 2
      target_met: true
      preserved: ["all citations", "all statistics"]

    final_action: "exported_to_word"
```

---

## Best Practices

### When to Use Each Mode

| Situation | Recommended Mode |
|-----------|------------------|
| Journal submission (high-impact) | Conservative or target: 30% |
| Journal submission (general) | Balanced or target: 30% |
| Conference paper | Balanced or target: 40% |
| Working paper | Balanced or target: 50% |
| Thesis chapter | Conservative |
| Grant proposal | Conservative |
| Blog post | Aggressive |
| Social media | Aggressive |
| Response letter | Balanced (Pass 1 only) |

### When to Skip Humanization

- AI probability < 20%
- Human-written original text
- Direct quotes or transcripts
- Highly technical/formulaic sections
- When author prefers original style

### Multi-Pass vs Single-Pass

| Situation | Approach |
|-----------|----------|
| Score > 60% | Multi-pass recommended (vocabulary + structural + discourse) |
| Score 40-60% | 2-3 passes usually sufficient |
| Score 20-40% | Single vocabulary pass may suffice |
| Score < 20% | Skip humanization |

---

## Integration with Existing Pipelines

### PRISMA Systematic Review Pipeline

Stage 7 (Manuscript Preparation) enhanced:

```yaml
stage_7_enhanced:
  steps:
    - "Draft sections (IMRAD)"
    - "Run G5 on each section (section-aware scoring)"
    - "Present humanization options with score targets"
    - "Apply multi-pass pipeline if approved"
    - "Verify with F5 after each pass"
    - "Create figures and tables"
    - "Export to Word with score progression report"
```

### Experimental Study Pipeline

Stage 6 (Manuscript & Dissemination) enhanced:

```yaml
stage_6_enhanced:
  steps:
    - "Write manuscript sections"
    - "Humanization pipeline (optional, multi-pass)"
    - "Create figures"
    - "Prepare supplementary"
    - "Submit to journal"
```

---

## MCP Tool Integration (v3.0)

The humanizer MCP server provides 5 tools for precise quantitative metrics, replacing LLM estimation in the pipeline:

| Tool | Pipeline Stage | Purpose |
|------|---------------|---------|
| `humanizer_metrics` | Stage 2 (G5 Analysis) | Exact burstiness CV, MTLD, Fano Factor, opener diversity + 13 metrics |
| `humanizer_verify` | After each G6 pass | Regression detection, needs_another_pass recommendation |
| `humanizer_diff` | Checkpoint reports | Per-metric deltas and improvement percentages |
| `humanizer_status` | Pipeline start | Baseline metrics with discipline-specific calibration |
| `humanizer_discourse` | Pass 3 (Discourse) | DT1-DT4 discourse pattern analysis, perturbation stats |

### Tool Call Sequence in Multi-Pass Flow

```
1. Pipeline Start:
   humanizer_status(text, discipline, target) -> baseline metrics + readiness

2. G5 Analysis (Stage 2):
   humanizer_metrics(text, pattern_score, structural_penalty, discipline) -> full 13 metrics

3. After each G6 Pass (Pass 1-2, 4):
   humanizer_verify(original, humanized, score_before, score_after)
   -> regressions, needs_another_pass, recommendations

4. After G6 Pass 3 (Discourse):
   humanizer_discourse(original, humanized, discourse_patterns)
   -> DT1-DT4 analysis, perturbation naturalization stats

5. Checkpoint Reports:
   humanizer_diff(original, humanized) -> deltas, improvement_pct, distributions
```

### Discipline Calibration (via MCP)

Pass `discipline` parameter to tools for field-specific thresholds:
- `"psychology"`: burstiness 0.40, MTLD 75
- `"management"`: burstiness 0.42, MTLD 78
- `"education"`: burstiness 0.43, MTLD 76
- `"default"`: burstiness 0.45, MTLD 80

### Fallback

If MCP tools are unavailable, agents fall back to LLM estimation as in v2.0.

---

## References

- **G5 Agent**: `../research-agents/G5-academic-style-auditor/SKILL.md`
- **G6 Agent**: `../research-agents/G6-academic-style-humanizer/SKILL.md`
- **F5 Agent**: `../research-agents/F5-humanization-verifier/SKILL.md`
- **User Checkpoints**: `./user-checkpoints.md`
- **Integration Hub**: `./integration-hub.md`
- **Humanizer Documentation**: https://github.com/HosungYou/humanizer
