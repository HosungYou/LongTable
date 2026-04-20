# Researcher Profile

## Purpose

연구자 프로필은 checkpoint 강도, 설명 방식, retrieval 우선순위를 조정하기 위한 적응형 레이어다.

## Structure

```yaml
researcher_profile:
  identity:
    field: education
    stage: doctoral
    experience_level: intermediate

  epistemic_style:
    orientation: rigor_first
    novelty_preference: medium
    ambiguity_tolerance: medium

  governance_preferences:
    preferred_checkpoint_intensity: medium
    strong_checkpoint_domains:
      - theory
      - measurement

  narrative_preferences:
    human_authorship_signal: visible judgment and reasoning path

  confidence_model:
    theory: low
    methodology: medium
    measurement: low
    analysis: medium
    writing: high
```

## Update Policy

- initial values come from setup
- later values are updated from repeated choices
- inferred changes must be confirmed before becoming explicit profile values

## Important Rule

Researcher profile is not a personality model. It is a governance and support model.

It may contain a lightweight authorship signal, but that signal is still a support parameter, not a personality inference.
