import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const tmp = mkdtempSync(join(tmpdir(), "longtable-grilling-interview-e2e-"));
const skillsDir = join(tmp, "codex-skills");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runCli(args) {
  return execFileSync("node", [join(repoRoot, "packages/longtable/dist/cli.js"), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? ""
    }
  });
}

runCli(["codex", "install-skills", "--dir", skillsDir]);

const interviewSkill = readFileSync(join(skillsDir, "longtable-interview", "SKILL.md"), "utf8");
const routerSkill = readFileSync(join(skillsDir, "longtable", "SKILL.md"), "utf8");

assert(interviewSkill.includes("LongTable grilling interview"), "interview skill should expose the grilling loop");
assert(interviewSkill.includes("Tension:"), "interview skill should require the tension frame");
assert(interviewSkill.includes("Pressure question:"), "interview skill should require a pressure-question frame");
assert(interviewSkill.includes("Ask exactly one question per turn"), "interview skill should stay compact");
assert(interviewSkill.includes("Wait for the researcher's direct answer"), "interview skill should require a direct-answer loop");
assert(!interviewSkill.includes("No option menus"), "interview skill should avoid prohibition-first wording");
assert(!interviewSkill.includes("approval prompts"), "interview skill should avoid prohibition-first wording");
assert(!interviewSkill.includes("accept, revise, or reject"), "interview skill should not ask for accept/revise/reject choices");
assert(!interviewSkill.includes("accept/revise/reject"), "interview skill should not ask for accept/revise/reject choices");
assert(!interviewSkill.includes("Recommended answer"), "interview skill should not use a recommended-answer frame");
assert(!interviewSkill.includes("recommended answer"), "interview skill should not use a recommended-answer frame");
assert(
  interviewSkill.includes("remaining questions repeat the same tension without producing a new decision"),
  "interview skill should preserve the grilling stop rule"
);
assert(!interviewSkill.includes("option-first"), "interview skill should not keep option-first mode");
assert(!interviewSkill.includes("ordinary follow-up"), "interview skill should not keep ordinary follow-up mode");
assert(!interviewSkill.includes("route to `$longtable-start` immediately"), "interview skill should not route itself away");
assert(!interviewSkill.includes("grill-me"), "interview skill should not advertise grill-me requests");
assert(routerSkill.includes("LongTable grilling interview"), "router should describe longtable-interview as grilling");
assert(routerSkill.includes("Pressure question:"), "router should preserve pressure-question behavior");
assert(routerSkill.includes("compact pressure loop"), "router should advertise the compact pressure loop");
assert(!routerSkill.includes("approval prompts"), "router should avoid prohibition-first wording");
assert(!routerSkill.includes("accept, revise, or reject"), "router should not advertise accept/revise/reject choices");
assert(!routerSkill.includes("accept/revise/reject"), "router should not advertise accept/revise/reject choices");
assert(!routerSkill.includes("Recommended answer"), "router should not advertise a recommended-answer frame");
assert(!routerSkill.includes("recommended answer"), "router should not advertise a recommended-answer frame");
assert(!routerSkill.includes("$critical-interview"), "router should not advertise critical-interview");
assert(!routerSkill.includes("$grill-me"), "router should not advertise grill-me");
assert(!routerSkill.includes("grill-me"), "router should not route grill-me requests");

console.log(JSON.stringify({
  skillsDir,
  interviewSurface: "longtable-interview",
  removedSurface: "critical-interview",
  observed: {
    grillingLoop: true,
    pressureQuestion: true,
    oldOrdinaryModeRemoved: true
  }
}, null, 2));
