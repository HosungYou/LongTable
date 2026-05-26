# LongTable 0.1.49 Release Notes

## Summary

LongTable 0.1.49 updates the Codex adapter for current Codex hook review and
trust behavior. The release keeps LongTable's checkpoint semantics in
LongTable-owned state while making native Codex hook installation quieter and
more diagnosable.

## Codex Hook Compatibility

- Codex hook setup now writes the current `[features] hooks = true` flag while
  still recognizing the legacy `codex_hooks = true` flag.
- `longtable codex install-hooks` writes managed Codex hook trust hashes for
  LongTable-managed `longtable-codex-native-hook.js` handlers.
- `longtable doctor` reports hook feature state, managed event coverage, and
  managed hook trust state separately.
- Managed Codex hook coverage now includes `PreCompact` and `PostCompact` in
  addition to `SessionStart`, `PreToolUse`, `PostToolUse`,
  `UserPromptSubmit`, and `Stop`.

## Runtime Boundary

- `PreCompact` stays quiet.
- `PostCompact` restores only compact, decision-relevant context such as active
  interviews or pending obligations.
- LongTable intentionally does not install a `PermissionRequest` hook in this
  release. Provider permission policy remains outside LongTable's checkpoint
  contract.

## Verification

- `npm run build`
- `npm run smoke:hooks`
