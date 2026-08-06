export interface CorpusCounts {
  readonly identified: number;
  readonly normalized: number;
  readonly parseRejected: number;
  readonly unique: number;
  readonly duplicateLinks: number;
  readonly titleAbstractScreened: number;
  readonly fulltextCandidates: number;
  readonly titleAbstractExcluded: number;
  readonly titleAbstractPending: number;
  readonly fulltextSought: number;
  readonly fulltextRetrieved: number;
  readonly fulltextNotRetrieved: number;
  readonly fulltextAssessed: number;
  readonly finalIncluded: number;
  readonly fulltextExcluded: number;
  readonly unresolved: number;
}

export interface CountEquationAudit {
  readonly name: string;
  readonly left: number;
  readonly right: number;
  readonly expression: string;
  readonly passed: boolean;
}

export interface CorpusInvariantAudit {
  readonly passed: boolean;
  readonly prismaEligible: boolean;
  readonly equations: readonly CountEquationAudit[];
}

function assertCounts(counts: CorpusCounts): void {
  for (const [name, value] of Object.entries(counts)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Corpus count ${name} must be a non-negative integer.`);
    }
  }
}

function equation(name: string, left: number, right: number, expression: string): CountEquationAudit {
  return { name, left, right, expression, passed: left === right };
}

export function verifyCorpusInvariants(counts: CorpusCounts): CorpusInvariantAudit {
  assertCounts(counts);
  const equations = [
    equation(
      "identification",
      counts.identified,
      counts.normalized + counts.parseRejected,
      "identified = normalized + parse_rejected"
    ),
    equation(
      "deduplication",
      counts.normalized,
      counts.unique + counts.duplicateLinks,
      "normalized = unique + duplicate_links"
    ),
    equation(
      "title_abstract_screening",
      counts.titleAbstractScreened,
      counts.fulltextCandidates + counts.titleAbstractExcluded + counts.titleAbstractPending,
      "title_abstract_screened = fulltext_candidates + excluded + pending"
    ),
    equation(
      "fulltext_retrieval",
      counts.fulltextSought,
      counts.fulltextRetrieved + counts.fulltextNotRetrieved,
      "fulltext_sought = retrieved + not_retrieved"
    ),
    equation(
      "fulltext_screening",
      counts.fulltextAssessed,
      counts.finalIncluded + counts.fulltextExcluded + counts.unresolved,
      "fulltext_assessed = final_included + fulltext_excluded + unresolved"
    )
  ];
  const passed = equations.every((entry) => entry.passed);
  return { passed, prismaEligible: passed, equations };
}
