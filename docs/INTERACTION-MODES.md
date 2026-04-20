# Interaction Modes

## Why Modes Matter

같은 이론 선택이라도 exploration 중인지, submission 직전인지에 따라 checkpoint 강도가 달라져야 한다.

## Modes

### Explore

- purpose: 자유 탐색
- checkpoint: minimal
- memory: lightweight

### Review

- purpose: critique, comparison, team review
- checkpoint: usually none or log-only
- output: evaluation, not commitment

### Draft

- purpose: generate or rewrite artifacts
- checkpoint: provenance and logging only

### Commit

- purpose: commit a research decision
- checkpoint: strong
- state update: yes

### Submit

- purpose: external release, IRB, preregistration, journal submission
- checkpoint: strongest
- verification: mandatory

## Rule

Checkpoint level must depend on mode, not only on agent identity.
