import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const audit = JSON.parse(execFileSync("node", [cli, "audit", "questions", "--json"], {
  cwd: repoRoot,
  encoding: "utf8"
}));

assert(audit.passed === true, "question audit should pass");

const byId = new Map(audit.fixtures.map((fixture) => [fixture.id, fixture]));
assert(byId.get("harness_philosophy")?.observedKinds.includes("harness_design"), "harness prompt should trigger harness design questions");
assert(byId.get("harness_philosophy")?.observedKinds.includes("philosophical_reflection"), "harness prompt should trigger philosophical checkpoint questions");
assert(byId.get("all_needed_questions")?.observedKinds.includes("question_policy"), "needed-questions prompt should trigger question policy");
assert(byId.get("trust_calibration_construct")?.observedKinds.includes("research_commitment"), "trust calibration prompt should trigger construct-boundary question");
assert(byId.get("protected_decision_closure")?.observedKinds.includes("research_commitment"), "protected-decision closure prompt should trigger research commitment");
assert((byId.get("low_stakes_copyedit")?.observedKinds ?? []).length === 0, "low-stakes copyedit should not auto-create blocking questions");

console.log("question audit smoke passed");
