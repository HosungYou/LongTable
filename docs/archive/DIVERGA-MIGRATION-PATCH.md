# LongTable Migration Patch

## Goal

본 `LongTable` repo에 refactoring contract를 옮길 때 필요한 최소 이식 단위를 정리한다.

## Patch Order

1. move setup output semantics first
2. move checkpoint contract second
3. move memory semantics third
4. wire Claude runtime to the new contract
5. add Codex runtime entry after contract parity is stable

## First Safe Imports

- `StudyContract`
- `DecisionRecord`
- `ArtifactRecord`
- `SetupPersistedOutput`
- numbered checkpoint parser
- LongTable-managed runtime config installer semantics

## Guardrails

- do not overwrite existing production Claude behavior in one patch
- preserve current install path until setup output path migration is tested
- port docs and schemas before runtime switches
- first write generated config to `~/.longtable/runtime/`, then wire provider-native locations in a separate patch
- for Claude, prefer advisory adoption before direct runtime authority migration

## Installer Patch

1. import generated setup from `~/.longtable/setup.json`
2. emit provider runtime config to a LongTable-managed path
3. verify provider runtime can read the generated artifact
4. only then patch provider-native config loading

## Claude Runtime Adoption

Recommended sequence:

1. read-only bridge
2. opt-in advisory adoption
3. selective runtime consumption
4. only after evidence and regression checks, consider authority migration
