# Research a question and resume its evidence

`lt research "question"` is the short entry to evidence collection. `longtable research` and the MCP `research` tool use the same implementation. No onboarding interview or separate model account is required.

```sh
lt research "Does generative AI tutoring improve independent learning?" --cwd ./study --json
lt research --run research_<id> --cwd ./study --json
```

The first call searches the registered metadata sources and writes a host-model discovery packet. The final source comparison includes only evidence cited by host-authored claims, never all unreviewed search candidates. The host (Codex, Claude, or another authorized caller) reads the evidence and writes the answer. LongTable itself does not call an external model or pretend that a result list is a synthesized answer. Repeating the same question resumes its saved evidence without network calls. Explicit search wording and term order are preserved, including short terms such as AI, 학교, and 정책. For a multilingual or poorly matched query, the host can refine retrieval without changing the original question: `lt research --run <id> --refresh --search-query "AI education implementation barriers"`. The query is recorded alongside the original question. Use `--refresh` to run a new search; previous revisions remain available and old claims are not silently carried into new evidence. `previousRevision` points to the earlier immutable JSON in `revisions/`; inspect it to compare prior sources/claims, then explicitly reattach any evidence and claims that remain valid. No revision automatically becomes a current research decision.

## Evidence and answer

Each question has `.longtable/research/<id>/run.json`, `packet.json`, `answer.md`, and immutable `revisions/<revision>.json`. A cross-process per-run lock rejects overlapping updates with retry guidance, so a successful update is not silently overwritten. After an interrupted process, inspect the PID in the adjacent `<id>.lock` before clearing a stale lock. These are research sidecars. They do not rewrite `.longtable/state.json`, researcher decisions, or `CURRENT.md`.

The core records are Source (URL, access time, date/version, hash), Evidence (source, locator, excerpt, depth), Claim (support, counterevidence, caveat), and Run (question, source outcomes, gaps, next action). Different arXiv versions and the published DOI record stay separate; matching DOIs link related sources instead of silently collapsing preprint/publication evidence. Publication dates may be year-only, and retraction/correction status is not currently checked automatically.

Search abstracts are marked `abstract`; a discoverable PDF does not count as a read paper. To bring in official reports, ACL/OpenReview material, or other sources retrieved with authorized host tools, save a bounded local text extraction and supply an evidence JSON array:

```json
[
  {
    "path": "report.txt",
    "title": "Official report title",
    "url": "https://institution.example/report",
    "kind": "official_report",
    "locator": "page 12, section 3",
    "excerpt": "Exact excerpt present in report.txt",
    "depth": "full_text_excerpt",
    "publishedAt": "2026-08-01",
    "version": "2"
  }
]
```

Paths resolve relative to the evidence JSON. Supported kinds are `scholarly`, `official_report`, `web`, and `local_document`; depths are `metadata`, `abstract`, and `full_text_excerpt`. The importer verifies an excerpt against the local file and stores its SHA-256. This verifies the local match, not the authenticity of the declared URL, the accuracy of a PDF extraction, or the semantic support of a claim. The host must inspect the original source and retain an honest locator/depth. A landing-page announcement is not full-text report evidence.

```sh
lt research --run research_<id> --cwd ./study --evidence-file evidence.json --json
```

Read the returned evidence IDs, then attach host-authored claims:

```json
{
  "claims": [
    {
      "id": "claim_1",
      "text": "A bounded finding supported by the cited excerpt.",
      "support": ["evidence_<existing-id>"],
      "counterevidence": [],
      "caveat": "State the source and generalization limits."
    }
  ]
}
```

```sh
lt research --run research_<id> --cwd ./study --answer-file answer.json
```

Missing citations, invented excerpts, duplicate claim IDs, and conflicting support/counterevidence references are rejected before changing the saved run. `draft_with_citations` means references passed structural validation; it does not certify the research conclusion. Counterevidence not yet found, full text not yet read, and unavailable sources remain visible.

## Source failures and access

The seven executable routes are Crossref, arXiv, OpenAlex, Semantic Scholar, PubMed, ERIC, and DOAJ. Other repositories and Korean institutional sites are accessible through the host's normal search/browser/local tools followed by evidence import, not through fictitious built-in search connectors. Doctor uses the same registry as execution and reports setup eligibility, not live availability.

Anonymous OpenAlex basic queries are permitted by the [current official authentication documentation](https://help.openalex.org/api/authentication/) (updated 2026-08-19). An optional existing key raises limits; remote quota/authentication failures are still reported. LongTable neither creates accounts nor buys credits. Source-report URLs and errors redact API credentials.

By default, one source failure leaves other results usable (`partial`). All routes failing produces `blocked`. `--require-all` preserves available evidence but leaves source-coverage-dependent conclusions incomplete when any requested route fails. `--require-full-text` retains a gap when a claim lacks full-text support. Neither flag expands access or automates a research commitment. Per-source timeouts include response-body parsing; callers of the library can set `timeoutMs` (default 15 seconds).

## Verification and release

- `npm test`: existing regressions plus failure/deadline/redaction, source registry consistency, CLI/MCP resume, local excerpt matching, counterevidence, and invalid-update preservation.
- `npm run eval:research`: 20 fixed questions across AI/agents, social science/education, and Korean policy. Synthetic fixtures test workflow contracts; the report explicitly does not claim live source recall or semantic answer quality.
- Live source coverage and actual source-supported answers require separately recorded real runs. API success alone does not establish useful full-text coverage.

All workspace packages and internal pins are staged at **0.1.73**. This is not an npm publication. A reviewed local runtime can be installed from a frozen commit into `~/.local/share/longtable/releases/<commit>` using the committed lockfile (`npm ci --ignore-scripts --no-audit --no-fund`, then `npm run build`). Its MCP entry is `packages/longtable-mcp/dist/server.js`, run with Node. Updating a client to this frozen path is separate from publishing the npm release.
