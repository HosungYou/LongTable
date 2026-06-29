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
assert(interviewSkill.includes("state the tension"), "interview skill should require the tension frame");
assert(interviewSkill.includes("recommended answer"), "interview skill should require a recommended answer");
assert(interviewSkill.includes("accept, revise, or reject"), "interview skill should ask for accept/revise/reject");
assert(
  interviewSkill.includes("remaining questions repeat the same tension without producing a new decision"),
  "interview skill should preserve the grilling stop rule"
);
assert(!interviewSkill.includes("option-first"), "interview skill should not keep option-first mode");
assert(!interviewSkill.includes("ordinary follow-up"), "interview skill should not keep ordinary follow-up mode");
assert(!interviewSkill.includes("route to `$longtable-start` immediately"), "interview skill should not route itself away");
assert(routerSkill.includes("LongTable grilling interview"), "router should describe longtable-interview as grilling");
assert(routerSkill.includes("recommended answer"), "router should preserve recommended-answer behavior");
assert(!routerSkill.includes("$critical-interview"), "router should not advertise critical-interview");

console.log(JSON.stringify({
  skillsDir,
  interviewSurface: "longtable-interview",
  removedSurface: "critical-interview",
  observed: {
    grillingLoop: true,
    recommendedAnswer: true,
    oldOrdinaryModeRemoved: true
  }
}, null, 2));
