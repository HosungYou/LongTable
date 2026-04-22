# Research Search

## Decision

LongTable search should be scholar-first, not web-first.

The goal is not to scrape whatever page a general search engine returns. The goal is to help the researcher form, test, and verify academic claims.

LongTable should therefore treat search as an evidence workflow:

1. clarify the research intent
2. route to scholarly metadata sources first
3. create evidence cards
4. verify whether a cited source actually supports the claim
5. record evidence status in project state

## Why General Web Search Is Not Enough

Generic web search often returns pages that are popular, commercial, shallow, or unrelated to the researcher's actual question.

For LongTable, search quality is not measured by number of links. It is measured by whether the result helps the researcher decide:

- what has been studied
- which construct or theory is being used
- what method or measurement choice is defensible
- whether a citation really supports a claim
- what gap remains unresolved

## Search Should Not Run For Every Question

LongTable should not call scholarly APIs on every user message.

Search is appropriate when the user asks for:

- literature discovery
- theory or construct grounding
- scale, measure, or instrument search
- empirical precedent
- citation verification
- current publication metadata
- venue or journal positioning
- systematic or scoping review support

Search is not needed for:

- private brainstorming
- rewriting the user's own text
- local project memory recap
- conceptual tradeoff discussion that does not make external factual claims
- checkpoint questions where the missing input is the researcher's own judgment

When uncertain, LongTable should ask one narrow question before searching:

```text
Are you looking for empirical papers, theory grounding, measurement instruments, or citation verification?
```

## Source Routing

LongTable should prefer source-specific scholarly routes before generic web search.

### Default scholarly sources

| Source | Main use | Setup posture |
| --- | --- | --- |
| arXiv | preprints, especially CS/stat/math/physics | no API key, but follow arXiv API terms and acknowledgement guidance |
| Crossref | DOI and bibliographic metadata | no sign-up; use `mailto` or contact email for polite usage |
| OpenAlex | broad scholarly metadata and full-text search | API key should be configured for reliable use |
| Semantic Scholar | paper discovery, abstracts, citation graph, PDF URLs when available | API key optional but recommended |
| PubMed / NCBI E-utilities | biomedical and health literature | API key optional for casual use; needed for higher request rates |
| ERIC | education research | public education database; API/export support should be treated as source-specific route |
| DOAJ | open-access journal/article metadata | useful for OA filtering; API behavior should be verified during implementation |
| Unpaywall | legal open-access location lookup by DOI | email parameter required |

### General web fallback

Generic web search should be a fallback when:

- scholarly sources return no useful metadata
- the object is a policy, tool, organization, or current event rather than a paper
- the user explicitly asks for web material
- a source-specific API is unavailable

General web results should never be mixed with peer-reviewed evidence without labeling the evidence class.

## Setup Requirements

Initial setup should not force all API credentials.

Instead, `longtable init` should eventually include an optional "research search" section:

```text
Do you want to configure scholarly search now?
1. Skip for now
2. Basic no-key search
3. Add contact email for polite scholarly APIs
4. Add optional API keys
```

Recommended setup fields:

- `LONGTABLE_CONTACT_EMAIL`
- `OPENALEX_API_KEY`
- `SEMANTIC_SCHOLAR_API_KEY`
- `NCBI_API_KEY`

Derived use:

- Crossref polite usage can use the contact email.
- Unpaywall requires a real email parameter.
- OpenAlex should use an API key for reliable API usage.
- Semantic Scholar and NCBI can run without keys in light use, but keys improve reliability or rate limits.

Do not store credentials in project `CURRENT.md`, `AGENTS.md`, or researcher-facing summaries.

## Provider Detection

NPM install location alone cannot reliably tell whether the current runtime is Claude Code or Codex.

LongTable should use a two-step model:

1. Ask the user for the preferred provider during setup.
2. Let `longtable doctor` inspect the local machine and report detected surfaces.

Potential doctor checks:

- `codex` command on PATH
- Claude Code command on PATH
- `~/.codex/skills`
- `~/.claude` or Claude plugin directories
- generated LongTable runtime artifacts under `~/.longtable/runtime`
- configured MCP entries

Provider detection should influence adapter installation, not core semantics.

## Citation Verification

LongTable should not stop at adding references.

A reference can be real and still fail to support the claim attached to it.

LongTable should therefore model citation support separately from source existence.

### Evidence status

- `sourced_fact`: the source directly supports the factual claim
- `inference`: the source supports premises, but LongTable adds interpretation
- `estimate`: no direct source; do not use as a strong research basis

### Citation support status

- `direct_support`: the source explicitly supports the claim
- `indirect_support`: the source is related but does not directly say the claim
- `background`: the source is useful context, not support
- `questionable_fit`: the source may be mismatched or overextended
- `not_verified`: metadata exists but support has not been checked

## Citation Verification Workflow

When the user asks LongTable to check hallucinations or verify references:

1. Extract claim-citation pairs.
2. Resolve each citation to metadata.
3. Retrieve abstract or legal full text when available.
4. Compare the claim against the available text.
5. Assign citation support status.
6. Report unsupported, overstated, or missing citations.

LongTable should be explicit about source depth:

- metadata only
- abstract only
- full text available
- full text not legally available
- secondary summary only

If only metadata or abstract is available, LongTable must not claim full-paper verification.

## Evidence Card

Search results should become evidence cards, not raw link lists.

Recommended card fields:

- title
- authors
- year
- venue
- DOI / PMID / arXiv ID / OpenAlex ID
- source route used
- abstract availability
- legal full-text availability
- research design, if visible
- constructs or measures, if visible
- main finding, if visible
- relevance to the current LongTable project
- citation support status
- limitations or verification gaps

## Panel Integration

Search should connect to panel orchestration.

Useful panel roles:

- `theory_critic`: checks conceptual fit and theory overreach
- `methods_critic`: checks design and causal/method claims
- `measurement_auditor`: checks construct validity and instrument fit
- `reviewer`: checks whether the evidence would satisfy peer review
- `venue_strategist`: checks whether evidence aligns with target venue expectations

The panel should not simply summarize search results. It should classify what the evidence can and cannot support.

## Lessons From Insane Search

`insane-search` is useful as an access-strategy reference, especially for:

- intent routing
- special endpoint index
- adaptive scheduler
- public JSON API preference
- Jina/reader fallback
- archive/cache fallback
- browser/network inspection for hard pages

LongTable should not copy its goal wholesale.

For research use, LongTable should avoid becoming a paywall or WAF bypass tool. It should prioritize legal, reproducible, scholarly routes and clearly label when full text is not available.

## Current V1 Implementation

`longtable search` is the explicit search entry point. It uses
`@longtable/cli` to build a deterministic `ResearchSearchIntent`, route to
Crossref, arXiv, OpenAlex, Semantic Scholar, PubMed/NCBI, ERIC, DOAJ, and
Unpaywall, then normalize results as `EvidenceCard` records.

V1 behavior:

- environment-variable credentials only; project files do not store API keys
- partial-search confirmation when requested sources are unavailable
- DOI/PMID/arXiv/OpenAlex/Semantic Scholar/title deduplication
- relevance ranking from keyword overlap, recency, citation count, source
  signal, and full-text availability
- metadata/abstract-based citation support labels only
- optional `--record` storage under `.longtable/evidence/<run-id>.json`

## Implementation Sequence

1. Done: add `ResearchSearchIntent` and `EvidenceCard` types.
2. Done: add a source router and explicit `longtable search` entry point.
3. Done: add Crossref, arXiv, OpenAlex, Semantic Scholar, PubMed, ERIC, DOAJ,
   and Unpaywall routes behind capability checks.
4. Done: add metadata/abstract-based citation support labels.
5. Done: record search outputs as evidence artifacts.
6. Next: connect evidence cards directly into panel results and decision records.
7. Later: add setup/doctor helpers for search credentials.

## Non-Goals

- scraping paywalled full text
- bypassing CAPTCHAs or login walls
- treating generic web search as peer-reviewed evidence
- claiming citation support from metadata alone
- calling every scholarly API for every user question
