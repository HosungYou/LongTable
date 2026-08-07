import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const fixtureRoot = join(repoRoot, "packages", "longtable-scholar-research", "fixtures", "browser");
const research = await import(join(repoRoot, "packages", "longtable-scholar-research", "dist", "index.js"));
const profiles = JSON.parse(await readFile(join(fixtureRoot, "signatures.json"), "utf8"));
const resultsHtml = await readFile(join(fixtureRoot, "wos-results.html"), "utf8");
const exportHtml = await readFile(join(fixtureRoot, "wos-export.html"), "utf8");

const resultsSnapshot = research.buildBrowserPageSnapshot({
  url: "https://database.example.test/wos/results",
  html: resultsHtml
});
const exportSnapshot = research.buildBrowserPageSnapshot({
  url: "https://database.example.test/wos/export",
  html: exportHtml
});
assert.equal(resultsSnapshot.authenticated, true);
assert(resultsSnapshot.elements.some((element) => element.role === "button" && element.name === "Export"));
assert(exportSnapshot.elements.some((element) => element.role === "combobox" && element.name === "File format"));

const resultsSignature = research.computeBrowserPageSignature(resultsSnapshot, profiles.wos_results_v1);
const whitespaceVariant = research.buildBrowserPageSnapshot({
  url: "https://database.example.test/wos/results",
  html: resultsHtml.replace(/>\s+</g, ">   <")
});
assert.equal(research.computeBrowserPageSignature(whitespaceVariant, profiles.wos_results_v1).hash, resultsSignature.hash);
assert.equal(resultsSignature.compatible, true);

const recipe = {
  id: "wos-results-v1",
  version: "1.0.0",
  databaseId: "wos",
  pageKind: "results",
  approvedSignatureHash: resultsSignature.hash,
  productionEligible: true,
  steps: [
    { capability: "readResultCount", selector: { role: "status", name: "Result count" } },
    { capability: "exportMetadata", selector: { role: "button", name: "Export" } }
  ]
};
assert.deepEqual(research.validateBrowserRecipe(recipe), []);
const replay = research.replayBrowserRecipe(recipe, resultsSnapshot, { mode: "production", resultCap: 2000 });
assert.equal(replay.status, "ready");
assert.equal(replay.observations.resultCount, 1234);
assert.deepEqual(replay.actions.map((action) => action.capability), ["readResultCount", "exportMetadata"]);

const coordinateRecipe = {
  ...recipe,
  id: "wos-results-coordinate-v1",
  steps: [{
    capability: "exportMetadata",
    coordinateFallback: { x: 900, y: 140, requiredSignatureHash: resultsSignature.hash }
  }]
};
assert.deepEqual(research.validateBrowserRecipe(coordinateRecipe), []);
assert.match(research.validateBrowserRecipe({
  ...coordinateRecipe,
  steps: [{ ...coordinateRecipe.steps[0], coordinateFallback: { x: 900, y: 140, requiredSignatureHash: "wrong" } }]
})[0], /signature/i);

const changedSnapshot = research.buildBrowserPageSnapshot({
  url: "https://database.example.test/wos/results",
  html: resultsHtml.replace('aria-label="Export"', 'aria-label="Download results"')
});
assert.equal(research.replayBrowserRecipe(recipe, changedSnapshot, { mode: "production", resultCap: 2000 }).hardStop.code, "UI_SIGNATURE_CHANGED");

const blockerCases = [
  ["<html><body><h1>Sign in</h1><input type='password'></body></html>", "LOGIN_REQUIRED"],
  ["<html><body><h1>Multi-factor authentication</h1><p>Enter verification code</p></body></html>", "MFA_OR_CAPTCHA_REQUIRED"],
  ["<html><body><h1>CAPTCHA</h1><p>Verify you are human</p></body></html>", "MFA_OR_CAPTCHA_REQUIRED"],
  ["<html><body><h1>Session expired</h1><p>Please sign in again</p></body></html>", "SESSION_EXPIRED"],
  ["<html data-authenticated='true'><body><h1>Updated terms of use</h1><button>Accept</button></body></html>", "TERMS_OR_ACCESS_UNCLEAR"]
];
for (const [html, code] of blockerCases) {
  const snapshot = research.buildBrowserPageSnapshot({ url: "https://database.example.test/wos", html });
  assert.equal(research.replayBrowserRecipe(recipe, snapshot, { mode: "production", resultCap: 2000 }).hardStop.code, code);
}

const capReplay = research.replayBrowserRecipe(recipe, resultsSnapshot, { mode: "production", resultCap: 1000 });
assert.equal(capReplay.hardStop.code, "DATABASE_RESULT_CAP_REACHED");
assert.equal(research.verifySubmittedQuery("TS=(hackathon)", "TS=(hackathon)").status, "supported");
assert.equal(research.verifySubmittedQuery("TS=(hackathon)", "TS=(innovation)").code, "QUERY_DRIFT_DETECTED");
assert.equal(research.verifyExportObservation(1234, 1234).status, "supported");
assert.equal(research.verifyExportObservation(1234, 1230).code, "EXPORT_COUNT_MISMATCH");
assert.equal(research.verifyDownloadPattern(
  { filename: "savedrecs.csv", mimeType: "text/csv" },
  { filenamePattern: /^savedrecs.*\.csv$/i, mimeTypes: ["text/csv"] }
).status, "supported");
assert.equal(research.verifyDownloadPattern(
  { filename: "error.html", mimeType: "text/html" },
  { filenamePattern: /^savedrecs.*\.csv$/i, mimeTypes: ["text/csv"] }
).code, "DOWNLOAD_PATTERN_CHANGED");

const explorationRecipe = { ...recipe, id: "exploration", productionEligible: false };
assert.equal(research.replayBrowserRecipe(explorationRecipe, resultsSnapshot, { mode: "production", resultCap: 2000 }).hardStop.code, "UI_SIGNATURE_CHANGED");
assert.equal(research.replayBrowserRecipe(explorationRecipe, resultsSnapshot, { mode: "pilot", resultCap: 2000 }).status, "ready");

console.log("browser recipe replay tests passed");
