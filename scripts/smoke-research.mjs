import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { runResearch, renderResearchRun } from "../packages/longtable/dist/research.js";
import { buildResearchSearchIntent, extractSearchKeywords, runResearchSearch, assessSearchSourceCapabilities, assessScholarResearchReadiness, SEARCH_SOURCE_REGISTRY } from "../packages/longtable-scholar-research/dist/index.js";
const response = (value) => ({ ok: true, status: 200, statusText: "OK", json: async () => value, text: async () => JSON.stringify(value) });
const fixture = { message: { items: [{ DOI: "10.1234/fixture", title: ["Test evidence"], abstract: "A fixture trial found improvement, with limited generalizability.", issued: { "date-parts": [[2026]] }, URL: "https://example.test/article" }] } };
let calls = 0;
const partialFetch = async (url) => { calls++; if (new URL(url).hostname === "api.crossref.org") return response(fixture); throw new Error("HTTP 429 quota exhausted"); };
const temp = await mkdtemp(join(tmpdir(), "lt-research-test-"));
try {
  const koreanQuestion = "학교 AI 활용 성과와 정책";
  assert.equal(buildResearchSearchIntent({ query: koreanQuestion }).query, koreanQuestion);
  assert.deepEqual(extractSearchKeywords(koreanQuestion), ["학교", "ai", "활용", "성과와", "정책"]);
  assert.equal(buildResearchSearchIntent({ query: "AI policy school learning" }).query, "AI policy school learning");
  const readiness = assessScholarResearchReadiness({});
  for (const capability of assessSearchSourceCapabilities(undefined, {})) {
    assert.equal(readiness.connectors.find((item) => item.name === SEARCH_SOURCE_REGISTRY[capability.source].name).status, capability.enabled ? "ready" : "missing");
  }
  const partial = await runResearchSearch({ query: "evidence", sources: "crossref,openalex", env: {}, fetch: partialFetch });
  assert.equal(partial.status, "partial"); assert.equal(partial.cards.length, 1); assert.equal(calls, 2);
  const strict = await runResearchSearch({ query: "evidence", sources: "crossref,openalex", env: {}, fetch: partialFetch, allowPartial: false });
  assert.equal(strict.status, "blocked"); assert.equal(strict.cards.length, 1);
  const timeout = await runResearchSearch({ query: "evidence", sources: "crossref,arxiv", env: {}, timeoutMs: 10,
    fetch: async (url) => new URL(url).hostname === "api.crossref.org" ? response(fixture) : { ...response({}), text: () => new Promise(() => {}) } });
  assert.equal(timeout.status, "partial"); assert.match(timeout.sourceReports[1].reason, /timed out/);
  const none = await runResearchSearch({ query: "evidence", sources: "openalex", env: {}, fetch: partialFetch });
  assert.equal(none.status, "blocked");
  const secrets = await runResearchSearch({ query: "evidence", sources: "openalex", env: { OPENALEX_API_KEY: "private-test-key" },
    fetch: async () => response({ results: [] }) });
  assert(!JSON.stringify(secrets).includes("private-test-key"));
  assert(!secrets.sourceReports[0].endpoint.includes("api_key=private"));
  await assert.rejects(() => runResearchSearch({ query: "evidence", timeoutMs: 0 }), /timeoutMs/);
  const initial = await runResearch({ cwd: temp, question: "Does an educational intervention improve learning?", sources: "crossref,openalex", env: {}, fetch: partialFetch });
  assert.equal(initial.run.answerStatus, "needs_synthesis"); assert.equal(initial.run.search.status, "partial");
  assert(!renderResearchRun(initial.run).includes("Test evidence"), "uncited discovery does not become a final source comparison");
  const beforeResume = calls;
  const resumed = await runResearch({ cwd: temp, question: initial.run.question, fetch: partialFetch });
  assert.equal(resumed.resumed, true); assert.equal(calls, beforeResume); assert.equal(resumed.run.revision, initial.run.revision);
  await assert.rejects(() => runResearch({ cwd: temp, runId: "../../escape" }), /Invalid/);
  await assert.rejects(() => runResearch({ cwd: temp, runId: initial.run.id, question: "Changed question" }), /cannot change/);
  await assert.rejects(() => runResearch({ cwd: temp, question: initial.run.question, sources: "eric" }), /scope changed/);
  const sourcePath = join(temp, "report.txt");
  await writeFile(sourcePath, "Official report fixture. A subgroup showed no improvement. This is test data.");
  const evidencePath = join(temp, "evidence.json");
  await writeFile(evidencePath, JSON.stringify([{ path: "report.txt", title: "Policy report fixture", url: "https://example.test/report", kind: "official_report", locator: "page 2", excerpt: "A subgroup showed no improvement.", depth: "full_text_excerpt", publishedAt: "2026-01-01", version: "1" }]));
  const imported = await runResearch({ cwd: temp, runId: initial.run.id, evidenceFile: evidencePath });
  assert.equal(imported.run.sources.length, 2); assert.equal(imported.run.evidence.at(-1).provenance, "local_file_match");
  const answerPath = join(temp, "answer.json");
  await writeFile(answerPath, JSON.stringify({ claims: [{ id: "claim_1", text: "The fixture evidence suggests improvement with a subgroup limitation.", support: [initial.run.evidence[0].id], counterevidence: [imported.run.evidence.at(-1).id], caveat: "Fixture only; no generalization." }] }));
  const answered = await runResearch({ cwd: temp, runId: initial.run.id, answerFile: answerPath, requiredFullText: true });
  assert(renderResearchRun(answered.run).includes("Policy report fixture"));
  const withUncited = structuredClone(answered.run);
  withUncited.sources.push({ ...answered.run.sources[0], id: "uncited_source", title: "Unrelated discovery candidate" });
  withUncited.evidence.push({ ...answered.run.evidence[0], id: "uncited_evidence", sourceId: "uncited_source", excerpt: "This is irrelevant to the question." });
  assert(!renderResearchRun(withUncited).includes("Unrelated discovery candidate"));
  assert(!renderResearchRun(withUncited).includes("This is irrelevant to the question."));
  assert.equal(answered.run.answerStatus, "draft_with_citations"); assert(answered.run.gaps.some((gap) => gap.includes("Required full-text support")));
  assert.match(renderResearchRun(answered.run), /Counterevidence:/); assert.match(renderResearchRun(answered.run), /Source comparison/);
  const cli = new URL("../packages/longtable/dist/cli.js", import.meta.url).pathname;
  const cliResumed = JSON.parse(execFileSync(process.execPath, [cli, "research", initial.run.question, "--cwd", temp, "--json"], { encoding: "utf8" }));
  assert.equal(cliResumed.resumed, true); assert.equal(cliResumed.run.claims.length, 1);
  const transport = new StdioClientTransport({ command: process.execPath, args: [new URL("../packages/longtable-mcp/dist/server.js", import.meta.url).pathname] });
  const client = new Client({ name: "longtable-research-smoke", version: "1.0.0" });
  try {
    await client.connect(transport);
    assert((await client.listTools()).tools.some((tool) => tool.name === "research"));
    const mcpResult = await client.callTool({ name: "research", arguments: { cwd: temp, runId: initial.run.id } });
    assert(!mcpResult.isError);
    const mcpRun = JSON.parse(mcpResult.content[0].text);
    assert.equal(mcpRun.resumed, true); assert.equal(mcpRun.run.claims.length, 1);
  } finally { await client.close(); }
  const strictResume = await runResearch({ cwd: temp, runId: initial.run.id, allowPartial: false });
  assert(strictResume.run.gaps.some((gap) => gap.includes("Required source coverage")));
  const savedBeforeInvalid = await readFile(initial.files.run, "utf8");
  await writeFile(answerPath, JSON.stringify({ claims: [{ id: "claim_1", text: "Unsupported", support: ["invented"] }] }));
  await assert.rejects(() => runResearch({ cwd: temp, runId: initial.run.id, answerFile: answerPath }), /invalid evidence/);
  assert.equal(await readFile(initial.files.run, "utf8"), savedBeforeInvalid);
  await writeFile(evidencePath, JSON.stringify([{ path: "report.txt", title: "Bad quote", url: "https://example.test/report", kind: "official_report", locator: "page 2", excerpt: "Invented evidence", depth: "full_text_excerpt" }]));
  await assert.rejects(() => runResearch({ cwd: temp, runId: initial.run.id, evidenceFile: evidencePath }), /does not occur/);
  assert.equal(await readFile(initial.files.run, "utf8"), savedBeforeInvalid);
  for (const url of ["https://example.test/doc?apikey=fixture-secret", "https://example.test/doc?%61pi%6bey=fixture-secret", "https://example.test/doc#access_token=fixture-secret", "https://example.test/doc?X-Amz-Signature=fixture-secret"]) {
    await writeFile(evidencePath, JSON.stringify([{ path: "report.txt", title: "Unsafe source", url, kind: "official_report", locator: "page 2", excerpt: "A subgroup showed no improvement.", depth: "full_text_excerpt" }]));
    await assert.rejects(() => runResearch({ cwd: temp, runId: initial.run.id, evidenceFile: evidencePath }), /without credentials/);
    assert.equal(await readFile(initial.files.run, "utf8"), savedBeforeInvalid);
  }
  const concurrent = await Promise.allSettled([
    runResearch({ cwd: temp, runId: initial.run.id }),
    runResearch({ cwd: temp, runId: initial.run.id })
  ]);
  assert.equal(concurrent.filter((item) => item.status === "fulfilled").length, 1);
  assert.match(concurrent.find((item) => item.status === "rejected").reason.message, /is busy/);
  assert.equal((await runResearch({ cwd: temp, runId: initial.run.id })).resumed, true);
  const refreshed = await runResearch({ cwd: temp, runId: initial.run.id, refresh: true, searchQuery: "AI tutoring learning trial", fetch: partialFetch, env: {} });
  assert.equal(refreshed.run.question, initial.run.question);
  assert.equal(refreshed.run.search.intent.query, "AI tutoring learning trial");
  await assert.rejects(() => runResearch({ cwd: temp, runId: initial.run.id, searchQuery: "Another search" }), /scope changed/);
  assert.equal(refreshed.run.search.status, "blocked"); assert.equal(refreshed.run.requireAllSources, true); assert.equal(refreshed.run.previousRevision, strictResume.run.revision);
  assert.equal(refreshed.resumed, false); assert.equal(refreshed.run.claims.length, 0); assert.notEqual(refreshed.run.revision, initial.run.revision);
  console.log("research smoke passed: partial/strict/deadline/redaction, CLI resume, local provenance, counterevidence, invalid-write preservation");
} finally { await rm(temp, { recursive: true, force: true }); }
