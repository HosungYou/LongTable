# AI Pattern Detection Rules v3.0

## Overview

This document consolidates detection rules, scoring algorithms, and threshold settings for the G5-AcademicStyleAuditor agent.

v3.0 adds discourse-level pattern detection (D1-D4), v3.0 composite scoring with 6 components (discourse_penalty, psycholinguistic_penalty), 9 new quantitative metrics, section-conditional weighting, and 7 discipline-specific calibration profiles.

**Reference**: Full literature background at https://github.com/HosungYou/humanizer

---

## Detection Algorithm

### Phase 1: Pattern Scanning

```
FOR each pattern category (C, L, S, M, H, A):
    FOR each pattern in category:
        SCAN text for indicators
        IF indicator found:
            CHECK academic context exceptions
            IF not excepted:
                LOG pattern instance with:
                    - Pattern ID
                    - Location (paragraph, sentence)
                    - Matched text
                    - Risk level
                    - Suggested transformation
```

### Phase 2: Quantitative Metric Calculation

```
# Original metrics (v2.0)
CV = compute_burstiness(text)
mtld_value = compute_MTLD(text)
length_range = compute_sentence_length_range(text)
opener_diversity = compute_paragraph_opener_diversity(text)

# New metrics (v3.0) -- via humanizer_discourse() MCP tool
hapax_rate = compute_hapax_rate(text)
contraction_density = compute_contraction_density(text)
paragraph_length_variance = compute_paragraph_length_variance(text)
surprisal_proxy = compute_surprisal_proxy(text)
surprisal_autocorrelation = compute_surprisal_autocorrelation(text)
connective_diversity = compute_connective_diversity(text)
pronoun_density = compute_pronoun_density(text)
question_ratio = compute_question_ratio(text)
abstract_noun_ratio = compute_abstract_noun_ratio(text)

# Compute penalty components
burstiness_penalty = max(0, (0.45 - CV) / 0.45 * 100)
vocab_diversity_penalty = max(0, (80 - mtld_value) / 80 * 100)
discourse_penalty = compute_discourse_penalty(connective_diversity, question_ratio, pronoun_density)
psycholinguistic_penalty = compute_psycholinguistic_penalty(hapax_rate, contraction_density, abstract_noun_ratio, surprisal_proxy)
```

### Phase 3: Structural Pattern Detection

```
FOR each structural pattern (S7, S8, S9, S10):
    SCAN text for structural indicators
    IF indicator found:
        LOG structural pattern instance

structural_penalty = normalize_0_100(
    S7_score * 12 + S8_score * 10 + S9_score * 8 + S10_score * 10
)
```

### Phase 3.5: Discourse Pattern Detection (NEW in v3.0)

```
FOR each discourse pattern (D1, D2, D3, D4):
    SCAN text for discourse-level indicators
    IF indicator found:
        LOG discourse pattern instance with:
            - Pattern ID (D1-D4)
            - Location (section)
            - Evidence
            - Risk level
            - Suggested DT strategy

D1: Connective Overuse
    IF formal_connectives_per_section > 3 OR connective_diversity < 0.50:
        FLAG D1 (Weight: 10, Risk: HIGH)

D2: Question Absence
    IF discussion_questions == 0 AND discussion_words > 500:
        FLAG D2 (Weight: 8, Risk: MEDIUM)

D3: First-Person Absence
    IF pronoun_density_non_methods < 0.01:
        FLAG D3 (Weight: 6, Risk: MEDIUM)

D4: Monotonic Rhetorical Sequence
    IF discussion_follows_default_5_step_template:
        FLAG D4 (Weight: 10, Risk: HIGH)
```

### Phase 4: Composite Scoring (v3.0)

```
# Normalize pattern score to 0-100 scale
pattern_score = min(100, total_score / max_expected_score * 100)

# Apply section-conditional multipliers
IF section == "Discussion":
    pattern_score *= 1.1
ELIF section == "Abstract":
    pattern_score *= 1.05
ELIF section == "Methods":
    pattern_score *= 0.8

# Composite formula (v3.0 -- 6 components)
AI_Probability = (0.40 * pattern_score)
              + (0.15 * burstiness_penalty)
              + (0.10 * vocab_diversity_penalty)
              + (0.10 * structural_penalty)
              + (0.15 * discourse_penalty)
              + (0.10 * psycholinguistic_penalty)
```

---

## Discourse Pattern Rules (NEW in v3.0)

### D1: Connective Overuse (Weight: 10, Risk: HIGH)

**Detection**:
```
formal_connectives = ["furthermore", "moreover", "in addition", "additionally",
                      "consequently", "subsequently", "nevertheless", ...]
connectives_found = find_all(formal_connectives, text)
connective_diversity = unique(connectives_found) / len(connectives_found)

IF connectives_per_section > 3:
    FLAG "Excessive formal connectives"
IF connective_diversity < 0.50:
    FLAG "Low connective diversity"
```

### D2: Question Absence (Weight: 8, Risk: MEDIUM)

**Detection**:
```
discussion_text = extract_section("Discussion", text)
question_marks = count("?", discussion_text)
discussion_words = word_count(discussion_text)

IF question_marks == 0 AND discussion_words > 500:
    FLAG "No rhetorical questions in Discussion"
```

### D3: First-Person Absence (Weight: 6, Risk: MEDIUM)

**Detection**:
```
first_person = ["i ", "we ", "my ", "our ", "us "]
non_methods = extract_sections(["Introduction", "Discussion", "Conclusion"], text)

pronoun_count = count_all(first_person, non_methods)
sentence_count = count_sentences(non_methods)
pronoun_density = pronoun_count / sentence_count

IF pronoun_density < 0.01:
    FLAG "No authorial voice outside Methods"
```

### D4: Monotonic Rhetorical Sequence (Weight: 10, Risk: HIGH)

**Detection**:
```
discussion = extract_section("Discussion", text)
moves = detect_rhetorical_moves(discussion)
# Moves: RESTATE, COMPARE, IMPLICATION, LIMITATION, FUTURE

IF moves == [RESTATE, COMPARE, IMPLICATION, LIMITATION, FUTURE]:
    FLAG "Predictable AI rhetorical sequence"
IF every_subsection_follows_same_sequence(discussion):
    FLAG "Monotonic subsection structure"
```

---

## Section-Conditional Weights (NEW in v3.0)

| Section | Score Multiplier | Rationale |
|---------|-----------------|-----------|
| Abstract | 1.05x | High scrutiny, condensed language |
| Introduction | 1.0x | Standard |
| Methods | 0.8x | Formulaic language expected |
| Results | 0.9x | Technical reporting expected |
| Discussion | 1.1x | Most benefit from discourse analysis |
| Conclusion | 1.05x | Similar to Discussion |

---

## Pattern Weights

| Pattern ID | Base Weight | Category |
|------------|-------------|----------|
| **Content** |
| C1 | 10 | Significance Inflation |
| C2 | 7 | Notability Claims |
| C3 | 6 | Superficial -ing |
| C4 | 10 | Promotional Language |
| C5 | 12 | Vague Attributions |
| C6 | 3 | Formulaic Sections |
| **Language** |
| L1-tier1 | 15 | AI Vocabulary (high alert) |
| L1-tier2 | 8 | AI Vocabulary (moderate) |
| L1-cluster | 20 | AI Vocab Clustering Bonus |
| L2 | 8 | Copula Avoidance |
| L3 | 6 | Negative Parallelism |
| L4 | 4 | Rule of Three |
| L5 | 7 | Elegant Variation |
| L6 | 3 | False Ranges |
| **Style (Original)** |
| S1 | 5 | Em Dash Overuse |
| S2 | 3 | Excessive Boldface |
| S3 | 6 | Inline-Header Lists |
| S4 | 2 | Title Case Overuse |
| S5 | 20 | Emoji Usage |
| S6 | 2 | Quote Inconsistency |
| **Style (Structural -- v2.0)** |
| S7 | 12 | Enumeration as Prose |
| S8 | 10 | Repetitive Paragraph Openers |
| S9 | 8 | Formulaic Section Structure |
| S10 | 10 | Hypothesis Checklist Pattern |
| **Communication** |
| M1 | 25 | Chatbot Artifacts |
| M2 | 30 | Knowledge Disclaimers |
| M3 | 10 | Sycophantic Tone |
| **Filler** |
| H1 | 2 | Verbose Phrases (per instance) |
| H2 | 8 | Hedge Stacking |
| H3 | 6 | Generic Conclusions |
| **Academic** |
| A1 | 4 | Abstract Template |
| A2 | 4 | Methods Boilerplate |
| A3 | 12 | Discussion Inflation |
| A4 | 15 | Citation Hedging |
| A5 | 3 | Contribution Enumeration |
| A6 | 3 | Limitation Disclaimers |
| **Discourse (v3.0)** |
| D1 | 10 | Connective Overuse |
| D2 | 8 | Question Absence |
| D3 | 6 | First-Person Absence |
| D4 | 10 | Monotonic Rhetorical Sequence |

---

## Risk Classification

### Risk Levels by Score

| Score Range | Risk Level | Label | Action |
|-------------|------------|-------|--------|
| 0-20 | Low | Likely Human | Optional review |
| 21-40 | Moderate | Mixed Signals | Recommended review |
| 41-60 | Elevated | Probably AI-Assisted | Review needed |
| 61-80 | High | Likely AI-Generated | Humanization recommended |
| 81-100 | Critical | Obviously AI | Humanization required |

### Risk Level by Pattern

| Risk Level | Patterns |
|------------|----------|
| **High** | C1, C4, C5, L1-tier1, S5, S7, S8, S10, M1, M2, A3, A4, D1, D4 |
| **Medium** | C2, C3, L1-tier2, L2, L3, L5, S1, S3, S9, M3, H2, H3, D2, D3 |
| **Low** | C6, L4, L6, S2, S4, S6, H1, A1, A2, A5, A6 |

---

## Context Modifiers

### Section-Based Multipliers (v3.0 updated)

| Section | Multiplier | Rationale |
|---------|------------|-----------|
| Abstract | 1.05 | High scrutiny |
| Introduction | 1.0 | Standard |
| Literature Review | 1.0 | Some formality expected |
| Methods | 0.8 | Boilerplate somewhat acceptable |
| Results | 0.9 | Technical reporting expected |
| Discussion | 1.1 | Most benefit from discourse analysis |
| Conclusion | 1.05 | Final impression matters |
| Response Letter | 0.9 | Some formality expected |

---

## Scoring

### Composite Formula (v3.0 -- 6 Components)

```
AI_Probability = (0.40 * pattern_score)
              + (0.15 * burstiness_penalty)
              + (0.10 * vocab_diversity_penalty)
              + (0.10 * structural_penalty)
              + (0.15 * discourse_penalty)
              + (0.10 * psycholinguistic_penalty)

Where:
  pattern_score               = Normalized 0-100 from Phase 1 pattern detection
  burstiness_penalty          = max(0, (0.45 - CV) / 0.45 * 100)
  vocab_diversity_penalty     = max(0, (80 - MTLD) / 80 * 100)
  structural_penalty          = Normalized 0-100 from S7+S8+S9+S10 weighted scores
  discourse_penalty           = f(connective_diversity, question_ratio, pronoun_density)
  psycholinguistic_penalty    = f(hapax_rate, contraction_density, abstract_noun_ratio, surprisal_proxy)
```

### v2.0 Backward Compatibility

```
scoring_version='v2':
  AI_Probability = (0.60 * pattern_score) + (0.20 * burstiness_penalty)
                + (0.10 * vocab_diversity_penalty) + (0.10 * structural_penalty)
```

### Component Weights Rationale (v3.0)

| Component | Weight | Rationale |
|-----------|--------|-----------|
| Pattern score | 40% | Core detection signal; 28 validated categories. Reduced from 60% to accommodate discourse/psycholinguistic signals |
| Burstiness penalty | 15% | Strong discriminator; reduced from 20% as discourse metrics provide complementary variance signals |
| Vocabulary diversity penalty | 10% | Complementary lexical signal; unchanged |
| Structural penalty | 10% | Section/paragraph-level fingerprints; unchanged |
| Discourse penalty | 15% | NEW: Hardest-to-evade signal (ACL 2024); connective, question, pronoun patterns |
| Psycholinguistic penalty | 10% | NEW: Sub-word frequency patterns that AI cannot easily mimic |

---

## Non-Native Speaker Calibration

**Research basis**: Liang et al. (2023) found >61% of TOEFL essays misclassified as AI.

This calibration is **opt-in only**.

```yaml
non_native_calibration:
  enabled: false
  adjustments:
    L1_weight: "x 0.7"
    H1_weight: "x 0.8"
    burstiness_threshold: 0.35
    hapax_threshold: 0.40        # NEW: lowered from 0.50
    contraction_threshold: 0.05  # NEW: lowered significantly
  scoring_impact:
    burstiness_penalty: "max(0, (0.35 - CV) / 0.35 * 100)"
    psycholinguistic_penalty: "reduced thresholds for hapax and contraction"
```

---

## Reporting Format

### Quick Summary (v3.0)

```
AI Pattern Analysis: 47% probability (v3.0 composite)
   Pattern: 42% | Burstiness: 31 | Vocab: 28 | Structural: 55 | Discourse: 62 | Psycholinguistic: 48
   Patterns: 15 found (4 high, 6 medium, 5 low)
   Discourse: D1 flagged (connective diversity: 0.38), D4 flagged (monotonic sequence)
   Recommendation: Review medium-risk patterns + apply DT1/DT4 discourse strategies
```

### Standard Report (v3.0)

```
## AI Pattern Analysis Report v3.0

### Summary
| Metric | Value |
|--------|-------|
| AI Probability (v3.0 composite) | 47% |
| Pattern Score | 42% |
| Burstiness CV | 0.31 (penalty: 31) |
| MTLD | 58 (penalty: 28) |
| Hapax Rate | 0.38 (AI-typical; target > 0.50) |
| Connective Diversity | 0.38 (AI-typical; target > 0.70) |
| Question Ratio | 0.00 (AI-typical; target > 0.03) |
| Discourse Penalty | 62 |
| Psycholinguistic Penalty | 48 |
| Structural Patterns | S7 x2, S8 x1 |
| Discourse Patterns | D1, D4 |

### Component Breakdown
| Component | Score | Weight | Contribution |
|-----------|-------|--------|-------------|
| Pattern | 42 | 0.40 | 16.8 |
| Burstiness | 31 | 0.15 | 4.65 |
| Vocabulary | 28 | 0.10 | 2.8 |
| Structural | 55 | 0.10 | 5.5 |
| Discourse | 62 | 0.15 | 9.3 |
| Psycholinguistic | 48 | 0.10 | 4.8 |
| **Total** | | | **43.85 ≈ 44%** |

### Recommendation
[C] Humanize (Aggressive) recommended -- discourse patterns require Layer 4 DT1-DT4
```

---

## Version History

- **v3.0.0**: Discourse pattern detection (D1-D4), v3.0 composite scoring (6 components), 9 new metrics, section-conditional weights, 7 discipline profiles, discourse_penalty/psycholinguistic_penalty sub-formulas, backward-compatible scoring_version parameter
- **v2.0.0**: Quantitative stylometric metrics (burstiness CV, MTLD, sentence length range, paragraph opener diversity), structural detection patterns S7-S10, composite scoring formula, non-native speaker calibration
- **v1.0.0**: Initial detection rules based on Wikipedia AI Cleanup
