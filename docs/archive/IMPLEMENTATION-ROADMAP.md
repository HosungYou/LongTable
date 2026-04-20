# Implementation Roadmap

## Phase 0: Lock Documents

- finalize PRD
- finalize Spec
- finalize checkpoint and memory contracts

## Phase 1: Core Contracts

- define schemas
- define state model
- define checkpoint policy engine
- define decision log contract

## Phase 2: Adapter Refactor

- extract Claude adapter
- define Codex adapter
- implement numbered checkpoint protocol

## Phase 3: Setup Refactor

- build quick setup
- build progressive calibration path
- connect setup outputs to profile seed and checkpoint defaults

## Phase 4: Runtime Validation

- test profile-aware checkpointing
- test mode-aware enforcement
- test memory restore and compaction

## Phase 5: Packaging and Release

- align package structure
- publish setup package
- document install surface
- add CI release workflow

## Exit Condition

LongTable should be able to describe itself as a researcher-centered harness without relying on provider-specific product language.
