# @longtable/research

Canonical LongTable Research runtime for journal-to-artifact execution.

It owns the versioned Research Brief handoff, lawful access plan, durable
ResearchBundle, search and full-text manifests, bounded provider packets,
independent verification, human evidence and visual gates, target-journal
profile, Research Assurance records, and Verified Research Package.

The runtime never automates institutional login or bypasses paywalls, WAFs,
robots controls, VPN restrictions, or proxies. Research figures and tables are
deterministic, editable, and data/provenance-bound; image generation is limited
to clearly labeled brand or concept artwork.

Use through:

```sh
longtable research run --brief research-brief.json --cwd .
longtable research verify --cwd . --json
```

`@longtable/scholar-research` is a one-release compatibility wrapper.
