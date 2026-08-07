import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const fixtureRoot = join(repoRoot, "packages", "longtable-scholar-research", "fixtures", "exports");
const research = await import(join(repoRoot, "packages", "longtable-scholar-research", "dist", "index.js"));
const expected = JSON.parse(await readFile(join(fixtureRoot, "expected-records.json"), "utf8"));

const cases = [
  ["wos.csv", "csv", "web_of_science"],
  ["scopus.ris", "ris", "scopus"],
  ["pubmed.nbib", "nbib", "pubmed"],
  ["crossref.json", "json", "crossref"],
  ["wos.xls", "spreadsheet_xml", "web_of_science"]
];

const observed = [];
for (const [filename, format, database] of cases) {
  const content = await readFile(join(fixtureRoot, filename));
  const parsed = research.parseExportArtifact({ filename, format, database, content });
  assert.equal(parsed.format, format);
  assert.equal(parsed.artifactSha256.length, 64);
  assert.equal(parsed.rejections.length, 0, `${filename} should have no parse rejections`);
  for (const record of parsed.records) {
    assert.equal(record.sourceDatabase, database);
    assert.equal(record.exportArtifactSha256, parsed.artifactSha256);
    assert(record.sourceRow >= 1);
    observed.push({
      sourceRecordId: record.sourceRecordId,
      title: record.title,
      year: record.year,
      ...(record.doi ? { doi: record.doi } : {}),
      authorCount: record.authors.length
    });
  }
}

assert.deepEqual(observed, expected);

const quoted = research.parseCsvExport(
  'Title,Authors,Publication Year,Abstract,Accession Number\r\n"A title, with comma","Doe, Jane; Roe, John",2024,"Line one\nline two",ID-1\r\n',
  { database: "test", artifactSha256: "a".repeat(64) }
);
assert.equal(quoted.records[0].title, "A title, with comma");
assert.equal(quoted.records[0].abstract, "Line one line two");

const missingTitle = research.parseCsvExport(
  "Title,Authors,Publication Year,Accession Number\n,Kim Mina,2024,ID-MISSING\n",
  { database: "test", artifactSha256: "b".repeat(64) }
);
assert.equal(missingTitle.records.length, 0);
assert.equal(missingTitle.rejections[0].reason, "missing_title");
assert.equal(missingTitle.rejections[0].sourceRecordId, "ID-MISSING");

const empty = research.parseExportArtifact({
  filename: "empty.csv",
  format: "csv",
  database: "test",
  content: Buffer.from("Title,Authors\n")
});
assert.equal(empty.records.length, 0);
assert.equal(empty.rejections[0].reason, "empty_export");

assert.throws(() => research.parseExportArtifact({
  filename: "unknown.bin",
  format: "binary",
  database: "test",
  content: Buffer.from([0, 1, 2])
}), /unsupported export format/i);

console.log("export parser golden tests passed");
