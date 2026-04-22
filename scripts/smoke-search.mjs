import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const search = await import(join(repoRoot, "packages", "longtable", "dist", "search", "index.js"));

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assert(condition, label) {
  if (!condition) {
    throw new Error(label);
  }
}

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    }
  };
}

function textResponse(payload) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    async json() {
      return JSON.parse(payload);
    },
    async text() {
      return payload;
    }
  };
}

async function mockFetch(url) {
  const parsed = new URL(url);
  if (parsed.hostname === "api.crossref.org") {
    if (parsed.pathname.startsWith("/works/10.1234%2Ftrust.2024.1")) {
      return jsonResponse({
        message: {
          DOI: "10.1234/trust.2024.1",
          publisher: "Elsevier",
          title: ["Trust calibration measurement in automated decision systems"],
          URL: "https://doi.org/10.1234/trust.2024.1",
          link: [{
            URL: "https://api.elsevier.com/content/article/doi/10.1234%2Ftrust.2024.1?httpAccept=text%2Fplain",
            "content-type": "text/plain",
            "content-version": "vor",
            "intended-application": "text-mining"
          }],
          license: [{
            URL: "https://www.elsevier.com/about/policies-and-standards/text-and-data-mining/license"
          }]
        }
      });
    }
    return jsonResponse({
      message: {
        items: [{
          title: ["Trust calibration measurement in automated decision systems"],
          author: [{ given: "Ari", family: "Kim" }],
          issued: { "date-parts": [[2024]] },
          "container-title": ["Journal of Trust Research"],
          DOI: "10.1234/trust.2024.1",
          URL: "https://doi.org/10.1234/trust.2024.1",
          abstract: "This survey validates a trust calibration scale for automated decision systems.",
          "is-referenced-by-count": 12
        }]
      }
    });
  }

  if (parsed.hostname === "api.elsevier.com") {
    if (!parsed.pathname.includes("/content/article/doi/")) {
      throw new Error(`Unexpected Elsevier path: ${parsed.pathname}`);
    }
    return textResponse("Full text section. This licensed article directly validates a trust calibration measurement instrument for automated decision systems.");
  }

  if (parsed.hostname === "export.arxiv.org") {
    return textResponse(`<?xml version="1.0"?>
      <feed>
        <entry>
          <id>http://arxiv.org/abs/2401.00001v1</id>
          <title>Trust calibration signals for human AI collaboration</title>
          <summary>We propose measurement indicators for trust calibration in human AI collaboration.</summary>
          <published>2024-01-01T00:00:00Z</published>
          <author><name>Rin Lee</name></author>
        </entry>
      </feed>`);
  }

  if (parsed.hostname === "api.openalex.org") {
    return jsonResponse({
      results: [{
        id: "https://openalex.org/W123",
        display_name: "Trust calibration measurement in automated decision systems",
        authorships: [{ author: { display_name: "Ari Kim" } }],
        publication_year: 2024,
        primary_location: {
          source: { display_name: "Journal of Trust Research" },
          landing_page_url: "https://doi.org/10.1234/trust.2024.1"
        },
        open_access: { is_oa: true },
        doi: "https://doi.org/10.1234/trust.2024.1",
        abstract_inverted_index: {
          This: [0],
          scale: [1],
          supports: [2],
          trust: [3],
          calibration: [4],
          measurement: [5]
        },
        cited_by_count: 22
      }]
    });
  }

  if (parsed.hostname === "api.semanticscholar.org") {
    return jsonResponse({
      data: [{
        paperId: "S2-123",
        title: "Trust calibration measurement in automated decision systems",
        authors: [{ name: "Ari Kim" }],
        year: 2024,
        venue: "Journal of Trust Research",
        externalIds: { DOI: "10.1234/trust.2024.1" },
        abstract: "This paper reports a validated measurement instrument for trust calibration.",
        citationCount: 30,
        openAccessPdf: { url: "https://example.test/paper.pdf" },
        url: "https://semanticscholar.org/paper/S2-123"
      }]
    });
  }

  if (parsed.hostname === "eutils.ncbi.nlm.nih.gov" && parsed.pathname.endsWith("/esearch.fcgi")) {
    return jsonResponse({ esearchresult: { idlist: ["987654"] } });
  }

  if (parsed.hostname === "eutils.ncbi.nlm.nih.gov" && parsed.pathname.endsWith("/esummary.fcgi")) {
    return jsonResponse({
      result: {
        "987654": {
          title: "Trust calibration and health AI decisions",
          authors: [{ name: "M. Patel" }],
          pubdate: "2023",
          fulljournalname: "Health AI"
        }
      }
    });
  }

  if (parsed.hostname === "api.ies.ed.gov") {
    return jsonResponse({
      response: {
        docs: [{
          id: "EJ123456",
          title: "Measuring calibrated trust in educational AI",
          author: ["Dana Smith"],
          publicationdateyear: 2022,
          source: "ERIC",
          description: "A survey instrument measures calibrated trust in educational AI systems."
        }]
      }
    });
  }

  if (parsed.hostname === "doaj.org") {
    return jsonResponse({
      results: [{
        id: "doaj-1",
        bibjson: {
          title: "Open access study of trust calibration measurement",
          author: [{ name: "Sam Park" }],
          year: 2021,
          journal: { title: "Open Research Methods" },
          identifier: [{ type: "doi", id: "10.5555/doaj.1" }],
          abstract: "This open access article discusses measurement of trust calibration.",
          link: [{ type: "fulltext", url: "https://example.test/fulltext" }]
        }
      }]
    });
  }

  if (parsed.hostname === "api.unpaywall.org") {
    return jsonResponse({
      results: [{
        response: {
          title: "Open copy of trust calibration measurement",
          year: 2024,
          journal_name: "Open Trust",
          doi: "10.1234/trust.2024.1",
          doi_url: "https://doi.org/10.1234/trust.2024.1",
          best_oa_location: { url: "https://example.test/oa.pdf" }
        }
      }]
    });
  }

  throw new Error(`Unexpected mock URL: ${url}`);
}

const blocked = await search.runResearchSearch({
  query: "trust calibration measurement",
  source: "test",
  sources: "openalex,unpaywall",
  projectGoal: "unrelated checkpoint behavior",
  env: {},
  fetch: mockFetch
});
assertEqual(blocked.status, "blocked", "missing credential route blocks without partial approval");
assertEqual(blocked.skippedSources.length, 2, "blocked route skipped source count");
assert(!blocked.intent.query.includes("checkpoint"), "explicit query should not be polluted by workspace context");

const run = await search.runResearchSearch({
  query: "trust calibration measurement instrument",
  intent: "measurement",
  field: "human AI trust",
  source: "test",
  sources: "crossref,arxiv,openalex,semantic_scholar,pubmed,eric,doaj,unpaywall",
  env: {
    OPENALEX_API_KEY: "test-openalex",
    LONGTABLE_CONTACT_EMAIL: "researcher@example.test"
  },
  fetch: mockFetch,
  allowPartial: true,
  limit: 10
});

assertEqual(run.status, "completed", "full mocked search status");
assertEqual(run.sourceReports.filter((report) => report.status === "completed").length, 8, "completed source count");
assert(run.cards.length >= 5, "search should produce ranked cards");
assert(run.cards[0].relevanceScore >= run.cards[run.cards.length - 1].relevanceScore, "cards sorted by score");
const merged = run.cards.find((card) => card.doi === "10.1234/trust.2024.1");
assert(merged, "duplicate DOI card should remain after dedupe");
assert(merged.sourceRoutes.length >= 3, "duplicate DOI card should merge source routes");
assert(["direct_support", "indirect_support"].includes(merged.citationSupportStatus), "merged card should have abstract-based support status");
assert(merged.accessStatus, "merged card should expose access status");
assert(merged.verificationNote.includes("not full-paper verified"), "abstract evidence should make verification depth explicit");

const publisherProbe = await search.probePublisherAccess({
  doi: "10.1234/trust.2024.1",
  publisher: "elsevier",
  env: {
    ELSEVIER_API_KEY: "test-elsevier",
    LONGTABLE_CONTACT_EMAIL: "researcher@example.test"
  },
  fetch: mockFetch
});
assertEqual(publisherProbe.credentialStatus, "valid", "Elsevier probe credential status");
assertEqual(publisherProbe.entitlementStatus, "licensed_full_text_available", "Elsevier probe entitlement status");
assertEqual(publisherProbe.collectionDepth, "licensed_snippet", "Elsevier probe collection depth");
assert(publisherProbe.evidenceSnippet && publisherProbe.evidenceSnippet.includes("directly validates"), "Elsevier probe should extract a short snippet");

const publisherRun = await search.runResearchSearch({
  query: "trust calibration measurement instrument",
  source: "test",
  sources: "crossref",
  env: {
    ELSEVIER_API_KEY: "test-elsevier",
    LONGTABLE_CONTACT_EMAIL: "researcher@example.test"
  },
  fetch: mockFetch,
  publisherAccess: true,
  allowPartial: true
});
const publisherCard = publisherRun.cards.find((card) => card.doi === "10.1234/trust.2024.1");
assert(publisherCard.publisherAccess, "publisher access enrichment should attach probe record");
assertEqual(publisherCard.accessStatus, "licensed_full_text_checked", "publisher-enriched access status");

const cliBlocked = JSON.parse(execFileSync("node", [
  cli,
  "search",
  "--query", "trust calibration measurement",
  "--source", "openalex",
  "--json"
], {
  cwd: repoRoot,
  encoding: "utf8",
  env: {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? ""
  }
}));
assertEqual(cliBlocked.run.status, "blocked", "CLI non-TTY missing credential status");

const cliDoctor = JSON.parse(execFileSync("node", [
  cli,
  "search",
  "doctor",
  "--json"
], {
  cwd: repoRoot,
  encoding: "utf8",
  env: {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? ""
  }
}));
assertEqual(cliDoctor.records.length, 4, "CLI search doctor should report four publisher adapters");
assert(cliDoctor.records.every((record) => !JSON.stringify(record).includes("test-elsevier")), "doctor output should not leak key values");

console.log("search smoke passed");
