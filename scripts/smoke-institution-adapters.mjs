import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const research = await import(join(repoRoot, "packages", "longtable-scholar-research", "dist", "index.js"));

const calls = [];
const fakeAdapter = {
  id: "fake-database",
  version: "1.0.0",
  capabilities: [...research.INSTITUTIONAL_RESEARCH_CAPABILITIES]
};
for (const capability of research.INSTITUTIONAL_RESEARCH_CAPABILITIES) {
  fakeAdapter[capability] = async (input) => {
    calls.push(capability);
    return { status: "supported", value: { capability, input } };
  };
}

assert.deepEqual(research.validateDatabaseAdapter(fakeAdapter), []);
for (const capability of research.INSTITUTIONAL_RESEARCH_CAPABILITIES) {
  const result = await research.executeAdapterCapability(fakeAdapter, capability, { runId: "run-1" });
  assert.equal(result.status, "supported");
  assert.equal(result.value.capability, capability);
}
assert.deepEqual(calls, research.INSTITUTIONAL_RESEARCH_CAPABILITIES);

const limitedAdapter = {
  id: "metadata-only",
  version: "1.0.0",
  capabilities: ["open"],
  async open() { return { status: "supported", value: { opened: true } }; }
};
const unsupported = await research.executeAdapterCapability(limitedAdapter, "exportMetadata", {});
assert.equal(unsupported.status, "unsupported");
assert.match(unsupported.reason, /does not declare/i);

const brokenAdapter = {
  id: "broken",
  version: "1.0.0",
  capabilities: ["open"]
};
assert.match(research.validateDatabaseAdapter(brokenAdapter)[0], /implementation/i);

const registry = research.createDatabaseAdapterRegistry([fakeAdapter, limitedAdapter]);
assert.equal(registry.get("fake-database"), fakeAdapter);
assert.deepEqual(registry.list().map((adapter) => adapter.id), ["fake-database", "metadata-only"]);
assert.throws(() => research.createDatabaseAdapterRegistry([fakeAdapter, fakeAdapter]), /duplicate/i);

const profileInput = JSON.parse(await readFile(
  join(repoRoot, "packages", "longtable-scholar-research", "fixtures", "institutions", "psu-sanitized.json"),
  "utf8"
));
const profile = research.createInstitutionProfile(profileInput);
assert.equal(profile.calibrationStatus, "draft_fixture");
assert.equal(profile.databases.length, 2);
assert.equal(JSON.stringify(profile).includes("token"), false);
assert.equal(JSON.stringify(profile).includes("cookie"), false);

const initialEligibility = research.assessInstitutionProductionEligibility(profile, {
  researcherLoginVerified: false,
  resolverDiscoveryVerified: false,
  calibrationDatabaseIds: [],
  fixtureReplayDatabaseIds: [],
  liveSmokeDatabaseIds: [],
  decisionRecordIds: []
});
assert.equal(initialEligibility.eligible, false);
assert(initialEligibility.missing.some((entry) => entry.includes("calibration")));
assert(initialEligibility.missing.some((entry) => entry.includes("fixture replay")));
assert(initialEligibility.missing.some((entry) => entry.includes("live smoke")));
assert(initialEligibility.missing.some((entry) => entry.includes("DecisionRecord")));

const completeEvidence = {
  researcherLoginVerified: true,
  resolverDiscoveryVerified: true,
  calibrationDatabaseIds: ["wos", "scopus"],
  fixtureReplayDatabaseIds: ["wos", "scopus"],
  liveSmokeDatabaseIds: ["wos", "scopus"],
  decisionRecordIds: ["decision-profile-psu"]
};
const completeEligibility = research.assessInstitutionProductionEligibility(profile, completeEvidence);
assert.equal(completeEligibility.eligible, true);
assert.deepEqual(completeEligibility.missing, []);

const checklist = research.buildInstitutionCalibrationChecklist(profile, completeEvidence);
assert.deepEqual(checklist.steps.map((step) => step.key), [
  "researcher_login",
  "database_and_resolver_discovery",
  "supervised_dry_run",
  "profile_approval",
  "fixture_replay",
  "live_smoke",
  "production_eligibility"
]);
assert.equal(checklist.steps.at(-1).complete, true);
assert(checklist.steps.every((step) => step.evidence.length > 0));

console.log("institution adapter and eligibility tests passed");
