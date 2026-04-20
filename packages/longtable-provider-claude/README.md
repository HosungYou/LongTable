# @longtable/provider-claude

Claude-specific adapter logic for LongTable.

This package does not define the product contract. It implements the Claude-facing surface after the contract is fixed in `@longtable/core`, `@longtable/checkpoints`, and `@longtable/setup` for LongTable.

Current responsibilities:

- structured checkpoint prompt rendering
- Claude runtime guidance shaping
- generated Claude runtime config fragments
