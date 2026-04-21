# Setup Strategy

## Objective

Setup should initialize runtime permissions and intervention posture. Researcher
profile calibration should happen progressively in `longtable start` and during
actual research turns.

## Setup Outputs

- provider approval
- install scope
- runtime surface approval
- intervention intensity baseline
- provider adapter configuration when approved

## Provider-Specific Install

### Claude

- install skills when approved
- install MCP settings when approved
- leave hooks/background monitoring opt-in

### Codex

- install skills when approved
- install MCP config when approved
- leave hooks/background monitoring opt-in

## Setup Principle

Technical installation and epistemic calibration should not be conflated.
`longtable setup` handles permissions; `longtable start` handles the first
research object, likely gap risk, and protected decision.

## Anti-Pattern

Do not ask setup questions that the system can infer later.
