import { createHash } from "node:crypto";
import type { CanonicalPaper } from "./corpus.js";
import type { CorpusCounts } from "./invariants.js";
import { verifyCorpusInvariants } from "./invariants.js";
import { renderReferenceFormats } from "./references.js";
import type { ProtocolRevision } from "./workflow-types.js";

export interface ManuscriptSection {
  readonly id: string;
  readonly heading: string;
  readonly content: string;
}

export interface ManuscriptProvenanceEntry {
  readonly objectId: string;
  readonly objectType: "paragraph" | "table" | "reference";
  readonly sha256: string;
  readonly inputArtifactIds: readonly string[];
  readonly protocolRevisionId: string;
}

export interface ApprovedManuscript {
  readonly title: string;
  readonly authorLines: readonly string[];
  readonly language: "ko" | "en";
  readonly abstract: string;
  readonly keywords: readonly string[];
  readonly protocol: ProtocolRevision;
  readonly sections: readonly ManuscriptSection[];
  readonly references: readonly string[];
  readonly unresolvedCitations: readonly { readonly paperId: string; readonly missingFields: readonly string[] }[];
  readonly metaAnalysisReadinessMarkdown: string;
  readonly provenanceMap: readonly ManuscriptProvenanceEntry[];
  readonly generatedAt: string;
  readonly generatorVersion: string;
}

export interface BuildApprovedManuscriptInput {
  readonly title: string;
  readonly authorLines: readonly string[];
  readonly language: "ko" | "en";
  readonly abstract?: string;
  readonly keywords: readonly string[];
  readonly protocol: ProtocolRevision;
  readonly counts: CorpusCounts;
  readonly papers: readonly CanonicalPaper[];
  readonly inputArtifactIds: readonly string[];
  readonly generatedAt: string;
  readonly generatorVersion: string;
  readonly approvals: {
    readonly databasesExecuted: boolean;
    readonly fulltextAvailabilityVerified: boolean;
    readonly analysisApproved: boolean;
  };
  readonly analysisPlan: string;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function readinessTable(papers: readonly CanonicalPaper[], analysisPlan: string): string {
  const isMeta = /meta/i.test(analysisPlan);
  return [
    "| 점검 항목 | 상태 | 근거 |",
    "|---|---|---|",
    `| 포함 연구 수 | ${papers.length}편 | 동결 코퍼스 |`,
    `| 효과크기 산출 가능성 | ${isMeta ? "개별 연구 통계량 추출 필요" : "현재 분석계획의 직접 산출 대상 아님"} | 승인된 분석계획: ${analysisPlan} |`,
    "| 표본·출판물 의존성 | 코딩 필요 | 저자·표본·데이터셋 중복 점검표 |",
    "| 결측 및 저자 연락 | 코딩 필요 | 전문 추출 ledger |"
  ].join("\n");
}

export function buildApprovedManuscript(input: BuildApprovedManuscriptInput): ApprovedManuscript {
  if (!input.approvals.databasesExecuted) throw new Error("Cannot render a manuscript that claims an unexecuted database search.");
  if (!input.approvals.fulltextAvailabilityVerified) throw new Error("Cannot render a manuscript before full-text availability is verified.");
  if (!input.approvals.analysisApproved) throw new Error("Cannot render an unapproved analysis.");
  if (!verifyCorpusInvariants(input.counts).passed) throw new Error("Cannot render a manuscript because corpus count invariants failed.");
  const references = renderReferenceFormats(input.papers);
  const databases = input.protocol.databases.join(", ");
  const sections: ManuscriptSection[] = input.language === "ko" ? [
    { id: "introduction", heading: "서론", content: "본 연구는 해커톤형 집중 프로그램과 직무역량 개발을 수요-공급 불일치의 관점에서 검토한다. 연구문제와 개념적 틀은 동결 프로토콜의 범위 안에서 해석한다." },
    { id: "methods", heading: "연구방법", content: `${databases}를 동결된 데이터베이스별 검색식과 포함·배제 기준으로 검색하였다. 메타데이터 내보내기, 정규화, 중복 연결, 제목·초록 선별, 전문 확보 및 전문 선별의 모든 판정을 append-only ledger에 기록하였다.` },
    { id: "results", heading: "결과", content: `총 ${input.counts.identified}건을 식별하였고, 중복 연결 후 ${input.counts.unique}건을 선별하였다. 전문 ${input.counts.fulltextAssessed}건을 평가하여 최종 ${input.counts.finalIncluded}편을 포함하였다.` },
    { id: "discussion", heading: "논의", content: "결과 해석은 동결 코퍼스와 승인된 분석계획에 한정한다. 직무역량 수요와 교육 공급의 불일치는 후속 문서 코딩 및 개념 매핑을 통해 검증한다." }
  ] : [
    { id: "introduction", heading: "Introduction", content: "This review examines hackathon-like intensive protocols and workplace competency development through a demand-supply mismatch lens." },
    { id: "methods", heading: "Method", content: `${databases} were searched using frozen database-specific queries and eligibility criteria. Export, normalization, duplicate linkage, screening, full-text acquisition, and synthesis decisions were retained in append-only ledgers.` },
    { id: "results", heading: "Results", content: `${input.counts.identified} records were identified; ${input.counts.unique} unique records were screened, ${input.counts.fulltextAssessed} reports were assessed in full text, and ${input.counts.finalIncluded} studies were included.` },
    { id: "discussion", heading: "Discussion", content: "Interpretation is limited to the frozen corpus and approved analysis plan. Demand-supply mismatch requires explicit document coding and construct mapping." }
  ];
  const metaAnalysisReadinessMarkdown = readinessTable(input.papers, input.analysisPlan);
  const inputIds = [...input.inputArtifactIds].sort();
  const provenanceMap: ManuscriptProvenanceEntry[] = [
    ...sections.map((section) => ({ objectId: section.id, objectType: "paragraph" as const, sha256: hash(section.content), inputArtifactIds: inputIds, protocolRevisionId: input.protocol.id })),
    { objectId: "meta-analysis-readiness", objectType: "table", sha256: hash(metaAnalysisReadinessMarkdown), inputArtifactIds: inputIds, protocolRevisionId: input.protocol.id },
    ...references.apa7References.map((reference, index) => ({ objectId: `reference-${index + 1}`, objectType: "reference" as const, sha256: hash(reference), inputArtifactIds: inputIds, protocolRevisionId: input.protocol.id }))
  ];
  return {
    title: input.title,
    authorLines: [...input.authorLines],
    language: input.language,
    abstract: input.abstract ?? "[초록은 승인된 연구 결과와 해석을 반영하여 작성해야 합니다.]",
    keywords: [...input.keywords],
    protocol: input.protocol,
    sections,
    references: references.apa7References,
    unresolvedCitations: references.unresolvedCitations,
    metaAnalysisReadinessMarkdown,
    provenanceMap,
    generatedAt: input.generatedAt,
    generatorVersion: input.generatorVersion
  };
}

