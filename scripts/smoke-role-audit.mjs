import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");

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

console.log("role audit smoke passed");
