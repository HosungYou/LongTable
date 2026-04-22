# LongTable 0.1.29 Release Notes

## Evidence Search

- Added scholar-first search as an internal `@longtable/cli` module.
- Added `longtable search` for literature discovery, citation checking,
  publication metadata, and evidence-backed research decisions.
- Routes queries through Crossref, arXiv, OpenAlex, Semantic Scholar,
  PubMed/NCBI, ERIC, DOAJ, and Unpaywall behind capability checks.
- Normalizes search results into EvidenceCards with source routes, identifiers,
  abstract/full-text availability, evidence depth, relevance score, and citation
  support status.

## Research Workflow

- Search runs can be recorded under `.longtable/evidence/<run-id>.json`.
- Recorded search runs add project state references without storing API keys in
  project files.
- Missing credentials block non-interactive full-router runs unless
  `--allow-partial` is supplied.

## Package Alignment

- Workspace packages are aligned on version `0.1.29`.
- MCP install snippets now point to `@longtable/mcp@0.1.29`.

## Verification

- `npm test`
- `npm run pack:check`
