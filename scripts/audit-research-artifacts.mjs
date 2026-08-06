import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FORBIDDEN_KEY = /(?:password|passphrase|credential|cookie|session[_-]?token|access[_-]?token|refresh[_-]?token|auth(?:entication|orization)?[_-]?header|mfa|one[_-]?time[_-]?(?:code|password)|captcha)/i;
const ABSOLUTE_USER_PATH = /(?:^|[\s"'])(?:\/Users\/[^/\s"']+|\/home\/[^/\s"']+|[A-Za-z]:\\Users\\[^\\\s"']+)/;
const LICENSED_BYTES = /LICENSED[_ -]FULLTEXT|DO[_ -]NOT[_ -]REDISTRIBUTE|publisher[_ -]licensed[_ -]copy/i;

function finding(artifactId, kind, location) {
  return { artifactId, kind, location };
}

function inspectValue(artifactId, value, path, findings) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const prefix = Buffer.from(value).subarray(0, 8192).toString("latin1");
    if (LICENSED_BYTES.test(prefix)) findings.push(finding(artifactId, "licensed_fulltext_bytes", path));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectValue(artifactId, entry, `${path}[${index}]`, findings));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const location = `${path}.${key}`;
      if (FORBIDDEN_KEY.test(key)) findings.push(finding(artifactId, "authentication_material_key", location));
      inspectValue(artifactId, nested, location, findings);
    }
    return;
  }
  if (typeof value === "string") {
    if (ABSOLUTE_USER_PATH.test(value)) findings.push(finding(artifactId, "absolute_user_path", path));
    if (LICENSED_BYTES.test(value)) findings.push(finding(artifactId, "licensed_fulltext_marker", path));
  }
}

export function auditResearchArtifactObjects(artifacts) {
  const findings = [];
  for (const artifact of artifacts) inspectValue(artifact.artifactId, artifact.value, "$", findings);
  findings.sort((left, right) => left.artifactId.localeCompare(right.artifactId) || left.kind.localeCompare(right.kind) || left.location.localeCompare(right.location));
  return { passed: findings.length === 0, findings };
}

async function walk(root) {
  const output = [];
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); } catch { return output; }
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (["node_modules", ".git", ".worktrees", "dist"].includes(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

async function auditRoots(repoRoot) {
  const candidateRoots = [
    join(repoRoot, ".longtable", "research-projects"),
    join(repoRoot, ".longtable", "research-runs"),
    join(repoRoot, "packages", "longtable-scholar-research", "fixtures", "institutions"),
    join(repoRoot, "packages", "longtable-scholar-research", "fixtures", "browser")
  ];
  const artifacts = [];
  for (const root of candidateRoots) {
    for (const path of await walk(root)) {
      const info = await stat(path);
      if (info.size > 5 * 1024 * 1024) {
        artifacts.push({ artifactId: relative(repoRoot, path), value: "oversized artifact omitted from value scan" });
        continue;
      }
      const bytes = await readFile(path);
      const id = relative(repoRoot, path);
      if (/\.(?:json|jsonl)$/i.test(path)) {
        const text = bytes.toString("utf8");
        try {
          const value = path.endsWith(".jsonl") ? text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) : JSON.parse(text);
          artifacts.push({ artifactId: id, value });
        } catch {
          artifacts.push({ artifactId: id, value: text });
        }
      } else if (/\.(?:ya?ml|md|txt|html)$/i.test(path)) {
        artifacts.push({ artifactId: id, value: bytes.toString("utf8") });
      } else {
        artifacts.push({ artifactId: id, value: bytes });
      }
    }
  }
  return auditResearchArtifactObjects(artifacts);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--fixtures")) {
    const clean = auditResearchArtifactObjects([{ artifactId: "fixture-clean", value: { accessBasis: "permitted", localPath: "corpus/paper.json" } }]);
    const seeded = auditResearchArtifactObjects([{ artifactId: "fixture-seeded", value: { access_token: "redacted-test-value" } }]);
    if (!clean.passed || seeded.passed || JSON.stringify(seeded).includes("redacted-test-value")) throw new Error("Research artifact audit fixture self-test failed.");
    console.log("research artifact audit fixtures passed");
    return;
  }
  const repoIndex = args.indexOf("--repo");
  const repoRoot = resolve(repoIndex >= 0 ? args[repoIndex + 1] ?? "." : ".");
  const report = await auditRoots(repoRoot);
  if (!report.passed) {
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(`research artifact audit passed for ${basename(repoRoot)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();

