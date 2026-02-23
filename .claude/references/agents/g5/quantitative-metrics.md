# Quantitative Metrics for AI Text Detection

## Overview

G5 v3.0 supplements pattern-based detection with 13 quantitative stylometric metrics that capture statistical properties of text. These metrics measure dimensions that pattern matching alone cannot detect -- specifically, the regularity of sentence production, the diversity of vocabulary and paragraph structure, discourse-level naturalness, and psycholinguistic characteristics that distinguish human writing from AI generation.

**Version**: 3.0.0
**Reference**: Full literature background at https://github.com/HosungYou/humanizer

### Research Basis

- GPTZero uses perplexity + burstiness as its two primary detection signals
- MTLD is the only length-invariant vocabulary diversity metric (McCarthy & Jarvis, 2010)
- Fano Factor > 1 indicates human-like super-Poissonian variance in sentence production
- A 2024 meta-analysis found stylometric methods alone detect GPT-4-level text at 70-80% precision, rising to ~90% when fused with ML classifiers
- Liang et al. (2023) documented >61% false positive rates for non-native English writers, motivating calibrated thresholds
- ACL 2024 research shows discourse motifs are the most reliable AI detection signal
- Originality.ai achieves 97% accuracy on humanized text when discourse patterns remain unchanged
- DivEye (NeurIPS 2025) demonstrates feature-based detection without generative models
- Hapax legomena (words appearing once) are a strong indicator of human vocabulary richness (Tweedie & Baayen, 1998)
- SUBTLEX word frequency norms (Brysbaert & New, 2009) provide empirical surprisal estimates

---

## Original Metrics (v2.0)

### Metric 1: Burstiness (Coefficient of Variation of Sentence Lengths)

Measures variance in sentence length across the document. Human writers naturally alternate between short punchy sentences (3-5 words) and extended complex constructions (30-50 words), creating high burstiness. LLMs tend toward medium-length sentences with consistent syntactic complexity.

| Population | CV Value | Interpretation |
|------------|----------|----------------|
| Human academic writing | > 0.45 | Natural rhythm with varied sentence length |
| AI-generated academic text | < 0.30 | Metronomic, narrow sentence length band |
| Non-native English academic | > 0.35 | Lower than native but higher than AI |

**Weight in v3.0 composite**: 0.15 (burstiness_penalty component)
**Penalty**: `max(0, (0.45 - CV) / 0.45 * 100)`

### Metric 2: MTLD (Measure of Textual Lexical Diversity)

The only length-invariant vocabulary diversity metric (McCarthy & Jarvis, 2010). Measures the mean length of sequential word strings that maintain a Type-Token Ratio above a threshold.

| Population | MTLD Value | Interpretation |
|------------|------------|----------------|
| Human academic writing | > 80 | Rich, varied vocabulary |
| AI-generated academic text | < 60 | Narrower vocabulary cycling |

**Weight in v3.0 composite**: 0.10 (vocab_diversity_penalty component)
**Penalty**: `max(0, (80 - MTLD) / 80 * 100)`

### Metric 3: Sentence Length Range

Simple but effective measure of whether the text contains both very short and very long sentences.

| Population | Range (words) | Interpretation |
|------------|---------------|----------------|
| Human academic writing | > 25 | Wide spread |
| AI-generated academic text | < 15 | Narrow band |

**Weight in composite**: Part of burstiness assessment (diagnostic)

### Metric 4: Paragraph Opener Diversity

Detects the AI tendency to start consecutive paragraphs with the same syntactic pattern.

| Population | Diversity Ratio | Interpretation |
|------------|-----------------|----------------|
| Human academic writing | > 0.70 | Most paragraphs start differently |
| AI-generated academic text | < 0.50 | Many paragraphs share opening patterns |

**Weight in composite**: Part of structural assessment

### Supplementary: Fano Factor

Fano Factor = Variance / Mean of sentence lengths. Fano > 1 indicates human-like super-Poissonian variance. Reported for diagnostic purposes only; not included in composite score.

---

## New Tier 1 Metrics (v3.0)

### Metric 5: Hapax Rate

**Purpose**: Measures the proportion of words that appear exactly once (hapax legomena) in the text. Human writers naturally use more unique, one-time words while AI tends to recycle a narrower vocabulary set.

**Research basis**: Tweedie & Baayen (1998) demonstrated hapax legomena as a reliable authorship indicator. AI text shows systematically lower hapax rates due to vocabulary recycling.

| Population | Hapax Rate | Interpretation |
|------------|------------|----------------|
| Human academic writing | > 0.50 | Rich vocabulary with many unique words |
| AI-generated academic text | < 0.35 | Vocabulary recycling, fewer unique words |

**Calculation**:
```
tokens = tokenize_and_lowercase(text)
word_counts = Counter(tokens)
hapax_count = sum(1 for count in word_counts.values() if count == 1)
hapax_rate = hapax_count / len(tokens)
```

**Feeds into**: psycholinguistic_penalty component

### Metric 6: Contraction Density

**Purpose**: Measures the frequency of contractions (don't, can't, we've, it's, etc.) per sentence. Human academic writers use contractions occasionally, while AI almost never does.

| Population | Density | Interpretation |
|------------|---------|----------------|
| Human academic writing | > 0.15 | Natural informal touches |
| AI-generated academic text | < 0.05 | Overly formal, no contractions |

**Calculation**:
```
contractions = regex_find_all(r"\b\w+(?:'[a-z]+)\b", text)
contraction_density = len(contractions) / sentence_count
```

**Note**: Field-dependent -- STEM papers have fewer contractions than humanities.
**Feeds into**: psycholinguistic_penalty component

### Metric 7: Paragraph Length Variance

**Purpose**: Measures variability in paragraph length. Human writers naturally vary paragraph length; AI tends toward uniform-length paragraphs.

| Population | CV | Interpretation |
|------------|-------|----------------|
| Human academic writing | > 0.40 | Varied paragraph lengths |
| AI-generated academic text | < 0.25 | Uniform paragraph lengths |

**Calculation**:
```
paragraphs = split_by_blank_lines(text)
word_counts = [count_words(p) for p in paragraphs]
paragraph_cv = std(word_counts) / mean(word_counts)
```

**Feeds into**: discourse_penalty component (as structural diversity signal)

### Metric 8: Surprisal Proxy

**Purpose**: Measures word-level information content using SUBTLEX word frequency norms. Human text shows higher variance in word surprisal (mixing common and rare words), while AI text uses consistently mid-frequency words.

**Research basis**: Based on SUBTLEX-US (Brysbaert & New, 2009), the most widely used word frequency norms. Words not in the dictionary receive maximum surprisal values.

| Population | Surprisal Variance | Interpretation |
|------------|-------------------|----------------|
| Human academic writing | High | Mix of common and rare words |
| AI-generated academic text | Low | Consistently mid-frequency words |

**Calculation**:
```
# Load SUBTLEX frequencies: data/word_frequencies.json
surprisal_values = [log(1/freq) for word in tokens if word in subtlex]
surprisal_variance = variance(surprisal_values)
```

**Feeds into**: psycholinguistic_penalty component

### Metric 9: Surprisal Autocorrelation

**Purpose**: Measures the temporal regularity of word-level surprisal. Human text shows irregular surprisal patterns (sudden shifts from simple to complex), while AI text maintains smooth, predictable surprisal trajectories.

| Population | Autocorrelation | Interpretation |
|------------|----------------|----------------|
| Human academic writing | High (irregular) | Unpredictable complexity shifts |
| AI-generated academic text | Low (smooth) | Predictable, gradual transitions |

**Calculation**:
```
surprisal_diffs = diff(surprisal_values)
autocorr = correlation(surprisal_diffs[:-2], surprisal_diffs[2:])  # lag-2
```

**Feeds into**: psycholinguistic_penalty component (supplementary signal)

---

## New Tier 2 Metrics (v3.0)

### Metric 10: Connective Diversity

**Purpose**: Measures the variety of discourse connectives used. AI text relies on a small set of formal connectives (Furthermore, Moreover, In addition) while human writers use diverse linking strategies.

| Population | Diversity | Interpretation |
|------------|-----------|----------------|
| Human academic writing | > 0.70 | Varied connective usage |
| AI-generated academic text | < 0.50 | Repetitive formal connectives |

**Calculation**:
```
connective_list = ~80 academic connectives (furthermore, moreover, however, ...)
found_connectives = [c for c in connective_list if c in text.lower()]
diversity = len(set(found_connectives)) / max(1, len(found_connectives))
```

**Feeds into**: discourse_penalty component

### Metric 11: Pronoun Density

**Purpose**: Measures first-person pronoun usage (I, we, my, our) per sentence. Human researchers naturally reference their own perspective; AI avoids first-person constructions.

| Population | Density | Interpretation |
|------------|---------|----------------|
| Human academic writing | Field-dependent | Natural authorial voice |
| AI-generated academic text | ~0 | Impersonal throughout |

**Note**: Highly field-dependent. Humanities papers use more first-person than STEM.
**Feeds into**: discourse_penalty component

### Metric 12: Question Ratio

**Purpose**: Measures the proportion of sentences that are questions. Human academic writers use rhetorical questions to frame arguments and engage readers; AI rarely generates questions.

| Population | Ratio | Interpretation |
|------------|-------|----------------|
| Human academic writing | > 0.03 | Natural rhetorical questions |
| AI-generated academic text | < 0.01 | Almost no questions |

**Feeds into**: discourse_penalty component

### Metric 13: Abstract Noun Ratio

**Purpose**: Measures the proportion of abstract nouns (detected via suffixes: -tion, -ness, -ity, -ment, -ance, -ence) relative to total nouns. AI text overuses abstract nominalizations.

| Population | Ratio | Interpretation |
|------------|-------|----------------|
| Human academic writing | < 0.30 | Balanced concrete/abstract |
| AI-generated academic text | > 0.45 | Over-nominalized |

**Feeds into**: psycholinguistic_penalty component

---

## Composite Scoring (v3.0)

### Formula

```
AI_Probability = (0.40 * pattern_score)
              + (0.15 * burstiness_penalty)
              + (0.10 * vocab_diversity_penalty)
              + (0.10 * structural_penalty)
              + (0.15 * discourse_penalty)
              + (0.10 * psycholinguistic_penalty)
```

### Component Calculation Summary

| Component | Source | Range | Weight |
|-----------|--------|-------|--------|
| pattern_score | Phase 1 pattern detection (28 categories) | 0-100 | 0.40 |
| burstiness_penalty | `max(0, (0.45 - CV) / 0.45 * 100)` | 0-100 | 0.15 |
| vocab_diversity_penalty | `max(0, (80 - MTLD) / 80 * 100)` | 0-100 | 0.10 |
| structural_penalty | S7+S8+S9+S10 weighted scores | 0-100 | 0.10 |
| discourse_penalty | connective_diversity + question_ratio + pronoun_density | 0-100 | 0.15 |
| psycholinguistic_penalty | hapax_rate + contraction_density + abstract_noun_ratio + surprisal_proxy | 0-100 | 0.10 |

### discourse_penalty Calculation

```
connective_penalty = max(0, (0.70 - connective_diversity) / 0.70 * 100)
question_penalty = max(0, (0.03 - question_ratio) / 0.03 * 100)
pronoun_penalty = max(0, (target_pronoun - actual_pronoun) / target_pronoun * 100)

discourse_penalty = 0.40 * connective_penalty + 0.35 * question_penalty + 0.25 * pronoun_penalty
```

### psycholinguistic_penalty Calculation

```
hapax_penalty = max(0, (0.50 - hapax_rate) / 0.50 * 100)
contraction_penalty = max(0, (target_contraction - actual) / target * 100)
abstract_penalty = max(0, (actual_abstract - 0.30) / 0.70 * 100)
surprisal_penalty = inversely proportional to surprisal_variance

psycholinguistic_penalty = 0.30 * hapax + 0.25 * contraction + 0.25 * abstract + 0.20 * surprisal
```

### v2.0 vs v3.0 Comparison

| Aspect | v2.0 | v3.0 |
|--------|------|------|
| Components | 4 | 6 |
| Pattern weight | 0.60 | 0.40 |
| Burstiness weight | 0.20 | 0.15 |
| Vocab weight | 0.10 | 0.10 |
| Structural weight | 0.10 | 0.10 |
| Discourse weight | -- | 0.15 |
| Psycholinguistic weight | -- | 0.10 |
| Accuracy ceiling | ~60% | ~85%+ |

---

## Discipline-Specific Calibration (7 Profiles)

| Discipline | Burstiness | MTLD | Contraction | Pronoun | Hapax | Notes |
|------------|-----------|------|-------------|---------|-------|-------|
| default | 0.45 | 80 | 0.10 | 0.05 | 0.45 | General academic |
| psychology | 0.40 | 75 | 0.08 | 0.04 | 0.42 | Measurement-focused |
| management | 0.42 | 78 | 0.12 | 0.06 | 0.44 | Action-oriented |
| education | 0.43 | 76 | 0.15 | 0.08 | 0.40 | Accessible language |
| stem | 0.38 | 82 | 0.02 | 0.02 | 0.48 | Formal, few contractions |
| humanities | 0.48 | 85 | 0.18 | 0.10 | 0.50 | Strong authorial voice |
| social_sciences | 0.44 | 79 | 0.10 | 0.06 | 0.44 | Citation-heavy |

---

## Metric Summary Table (All 13)

| # | Metric | Method | Human Baseline | AI Typical | Component |
|---|--------|--------|----------------|------------|-----------|
| 1 | Burstiness (CV) | SD / Mean sentence lengths | > 0.45 | < 0.30 | burstiness_penalty |
| 2 | MTLD | Factor length at TTR > 0.72 | > 80 | < 60 | vocab_diversity_penalty |
| 3 | Sentence Length Range | max - min word count | > 25 | < 15 | (diagnostic) |
| 4 | Paragraph Opener Diversity | unique_first_3 / total | > 0.70 | < 0.50 | (structural) |
| 5 | Hapax Rate | 1x words / total | > 0.50 | < 0.35 | psycholinguistic_penalty |
| 6 | Contraction Density | contractions / sentences | > 0.15 | < 0.05 | psycholinguistic_penalty |
| 7 | Paragraph Length Variance | CV of para word counts | > 0.40 | < 0.25 | discourse_penalty |
| 8 | Surprisal Proxy | Var(SUBTLEX log(1/f)) | High | Low | psycholinguistic_penalty |
| 9 | Surprisal Autocorrelation | lag-2 autocorr of diffs | High | Low | psycholinguistic_penalty |
| 10 | Connective Diversity | unique / total connectives | > 0.70 | < 0.50 | discourse_penalty |
| 11 | Pronoun Density | I/we/my/our per sentence | Field-dependent | ~0 | discourse_penalty |
| 12 | Question Ratio | questions / sentences | > 0.03 | < 0.01 | discourse_penalty |
| 13 | Abstract Noun Ratio | abstract / total nouns | < 0.30 | > 0.45 | psycholinguistic_penalty |
| -- | Fano Factor (supplementary) | Var / Mean sentence lengths | > 1.0 | < 1.0 | (diagnostic) |

---

## Version History

- **v3.0.0**: 9 new metrics (hapax rate, contraction density, paragraph length variance, surprisal proxy, surprisal autocorrelation, connective diversity, pronoun density, question ratio, abstract noun ratio), v3.0 composite scoring (6 components), 7 discipline profiles, discourse_penalty and psycholinguistic_penalty sub-formulas
- **v2.0.0**: Initial quantitative metrics module with burstiness CV, MTLD, sentence length range, paragraph opener diversity, and Fano Factor
