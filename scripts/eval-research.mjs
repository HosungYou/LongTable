import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runResearch } from "../packages/longtable/dist/research.js";
const questions = JSON.parse(await readFile(new URL("../tests/fixtures/research-questions.json", import.meta.url), "utf8"));
const directory = await mkdtemp(join(tmpdir(), "lt-research-eval-"));
const rows = [];
try {
  for (const [index, item] of questions.entries()) {
    let calls = 0;
    const fetch = async (url) => {
      calls++;
      if (new URL(url).hostname === "api.openalex.org") throw new Error("Fixture: quota unavailable");
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ message: { items: [{
        DOI: `10.1234/eval.${index}`, title: [`Fixture for ${item.id}`], URL: `https://example.test/${item.id}`,
        abstract: "This fixture reports a bounded positive finding; replication and generalization remain uncertain.",
        issued: { "date-parts": [[2026]] }
      }] } }) };
    };
    const result = await runResearch({ cwd: directory, question: item.question, sources: "crossref,openalex", env: {}, fetch });
    assert.equal(result.run.question, item.question); assert.equal(result.run.search.status, "partial");
    assert.equal(result.run.answerStatus, "needs_synthesis");
    const answerPath = join(directory, "answer.json");
    await writeFile(answerPath, JSON.stringify({ claims: [{ id: "fixture_claim", text: "The fixture reports a bounded positive finding with unresolved generalization.", support: [result.run.evidence[0].id], counterevidence: [], caveat: "Synthetic fixture; not an answer to the research question." }] }));
    const attached = await runResearch({ cwd: directory, runId: result.run.id, answerFile: answerPath });
    const resumed = await runResearch({ cwd: directory, question: item.question, fetch });
    assert.equal(calls, 2); assert.equal(resumed.run.claims.length, 1); assert(resumed.run.gaps.some((gap) => gap.includes("Counterevidence")));
    rows.push({ ...item, partialProgress: true, questionPreserved: true, resumeNetworkCalls: calls - 2,
      citationReferencesValid: true, uncertaintyPreserved: true, answerStatus: attached.run.answerStatus });
  }
  console.log(JSON.stringify({ evaluation: "Deterministic contract fixtures, not semantic answer quality or live source recall", cases: rows.length,
    passed: rows.length, semanticCitationSupport: "not_measured", liveSourceRecall: "not_measured", rows }, null, 2));
} finally { await rm(directory, { recursive: true, force: true }); }
