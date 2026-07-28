import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
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

runCli(["codex", "install-skills", "--surface", "full", "--dir", skillsDir]);

const routerSkill = readFileSync(join(skillsDir, "longtable", "SKILL.md"), "utf8");
const installedSkills = readdirSync(skillsDir).sort();

assert(
  JSON.stringify(installedSkills) === JSON.stringify(["longtable", "longtable-research"]),
  "even the deprecated full surface should install exactly the two public skills"
);
assert(!existsSync(join(skillsDir, "longtable-interview")), "legacy interview skill should be pruned");
assert(routerSkill.includes("grilling or pressure-interview intent"), "router should describe the internal pressure-interview route");
assert(routerSkill.includes("Pressure question:"), "router should preserve pressure-question behavior");
assert(routerSkill.includes("pressure-interview route"), "router should advertise the pressure-interview route");
assert(routerSkill.includes("at most three clarifying questions"), "router should bound first-use questioning");
assert(routerSkill.includes("versioned Research Brief"), "router should produce the durable handoff");
assert(routerSkill.includes("start LongTable Research, keep shaping, or save and stop"), "router should expose the three first-use choices");
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
  installedSkills,
  interviewSurface: "longtable internal pressure-interview route",
  removedSurfaces: ["critical-interview", "longtable-interview"],
  observed: {
    grillingLoop: true,
    pressureQuestion: true,
    boundedResearchBrief: true,
    oldOrdinaryModeRemoved: true
  }
}, null, 2));
