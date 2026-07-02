import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const codex = await import(join(repoRoot, "packages", "longtable-provider-codex", "dist", "skills.js"));
const claude = await import(join(repoRoot, "packages", "longtable-provider-claude", "dist", "skills.js"));
const personas = await import(join(repoRoot, "packages", "longtable", "dist", "personas.js"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const audit = JSON.parse(execFileSync("node", [cli, "audit", "roles", "--json"], {
  cwd: repoRoot,
  encoding: "utf8"
}));

assert(audit.passed === true, "role audit should pass");
assert(audit.totals.roleCount >= 8, "role audit should cover generated role skills");

for (const role of audit.roles) {
  assert(role.missingSections.length === 0, `${role.provider}:${role.name} should include all required sections`);
  assert(role.warnings.length === 0, `${role.provider}:${role.name} should not have quality warnings`);
}

const tmp = mkdtempSync(join(tmpdir(), "longtable-role-audit-"));
const promptsDir = join(tmp, "prompts");
execFileSync("node", [cli, "codex", "install-prompts", "--dir", promptsDir], {
  cwd: tmp,
  encoding: "utf8"
});
const reviewerPromptAlias = readFileSync(join(promptsDir, "longtable-reviewer.md"), "utf8");
const editorPrompt = execFileSync("node", [
  cli,
  "review",
  "--cwd",
  tmp,
  "--role",
  "editor",
  "--prompt",
  "Evaluate whether this framing is journal-ready.",
  "--print"
], {
  cwd: tmp,
  encoding: "utf8"
});

assert(editorPrompt.includes("Journal Editor"), "editor role should be disclosed in generated prompts");
assert(
  editorPrompt.includes("Assesses venue fit, framing strength, and editorial salience."),
  "editor role guidance should include the persona judgment criteria"
);

const reviewerPrompt = execFileSync("node", [
  cli,
  "review",
  "--cwd",
  tmp,
  "--role",
  "reviewer",
  "--prompt",
  "Evaluate this manuscript positioning for Journal of Management using reference papers.",
  "--print"
], {
  cwd: tmp,
  encoding: "utf8"
});

const roles = personas.listRoleDefinitions();
const codexCompactNames = codex.buildCodexSkillSpecs(roles, "compact").map((skill) => skill.name);
const claudeCompactNames = claude.buildClaudeSkillSpecs(roles, "compact").map((skill) => skill.name);
const codexEditor = codex.buildCodexSkillSpecs(roles, "full").find((skill) => skill.name === "longtable-editor");
const claudeEditor = claude.buildClaudeSkillSpecs(roles, "full").find((skill) => skill.name === "longtable-editor");
const codexReviewer = codex.buildCodexSkillSpecs(roles, "compact").find((skill) => skill.name === "longtable-reviewer");
const claudeReviewer = claude.buildClaudeSkillSpecs(roles, "compact").find((skill) => skill.name === "longtable-reviewer");
const journalFitBoundary =
  "If a target journal is named, do not claim journal fit from role intuition alone.";
const journalGroundedReviewerMarkers = [
  "Journal-grounded reviewer workflow",
  "Journal Profile",
  "Reference Pattern Matrix",
  "decision structure",
  "standardized terminology",
  "Figure/Table",
  "APA 7",
  "Venue Strategist",
  "scholar-research"
];

assert(codexEditor?.body.join("\n").includes(journalFitBoundary), "Codex editor skill should require journal evidence before fit claims");
assert(claudeEditor?.body.join("\n").includes(journalFitBoundary), "Claude editor skill should require journal evidence before fit claims");
assert(!codexCompactNames.includes("longtable-editor"), "Codex compact surface should not split editor into a separate visible skill");
assert(!claudeCompactNames.includes("longtable-editor"), "Claude compact surface should not split editor into a separate visible skill");
for (const marker of journalGroundedReviewerMarkers) {
  assert(codexReviewer?.body.join("\n").includes(marker), `Codex reviewer skill should include ${marker}`);
  assert(claudeReviewer?.body.join("\n").includes(marker), `Claude reviewer skill should include ${marker}`);
  assert(reviewerPrompt.includes(marker), `reviewer prompt should include ${marker}`);
  assert(reviewerPromptAlias.includes(marker), `reviewer prompt alias should include ${marker}`);
}

console.log("role audit smoke passed");
