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
assert(audit.totals.roleCount === 0, "provider installs should not expose standalone role skills");

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
const journalGroundedReviewerMarkers = [
  "Journal-grounded reviewer workflow",
  "Journal Profile",
  "Reference Pattern Matrix",
  "decision structure",
  "standardized terminology",
  "Figure/Table",
  "APA 7",
  "Venue Strategist",
  "longtable-research"
];

assert(!codexCompactNames.includes("longtable-editor"), "Codex compact surface should not split editor into a separate visible skill");
assert(!claudeCompactNames.includes("longtable-editor"), "Claude compact surface should not split editor into a separate visible skill");
assert(JSON.stringify(codexCompactNames.sort()) === JSON.stringify(["longtable", "longtable-research"]), "Codex should expose only two skills");
assert(JSON.stringify(claudeCompactNames.sort()) === JSON.stringify(["longtable", "longtable-research"]), "Claude should expose only two skills");
assert(
  JSON.stringify(codex.buildCodexSkillSpecs(roles, "full").map((skill) => skill.name).sort()) === JSON.stringify(["longtable", "longtable-research"]),
  "Deprecated Codex full surface should not regenerate role skills"
);
assert(
  JSON.stringify(claude.buildClaudeSkillSpecs(roles, "full").map((skill) => skill.name).sort()) === JSON.stringify(["longtable", "longtable-research"]),
  "Deprecated Claude full surface should not regenerate role skills"
);
for (const marker of journalGroundedReviewerMarkers) {
  assert(reviewerPrompt.includes(marker), `reviewer prompt should include ${marker}`);
  assert(reviewerPromptAlias.includes(marker), `reviewer prompt alias should include ${marker}`);
}

console.log("role audit smoke passed");
