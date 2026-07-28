import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import type { VisualEvidenceContract } from "./visual-contract.js";

export const ALLOWLISTED_VISUAL_RENDERERS = ["longtable-svg-v1"] as const;
export type AllowlistedVisualRenderer = typeof ALLOWLISTED_VISUAL_RENDERERS[number];

export interface VisualRenderRequest {
  schema: "longtable.visual-render-request";
  version: 1;
  runId: string;
  contractId: string;
  renderer: AllowlistedVisualRenderer;
  widthPx: number;
  heightPx: number;
  specification:
    | {
        kind: "table";
        columns: Array<{ field: string; label: string; align?: "left" | "right" }>;
        maxRows?: number;
      }
    | {
        kind: "figure";
        mark: "bar" | "line" | "point";
        orientation?: "vertical" | "horizontal";
        xField: string;
        yField: string;
        seriesField?: string;
        denominatorField?: string;
        directLabel?: "value" | "fraction_percent";
        xLabel: string;
        yLabel: string;
      }
    | {
        kind: "diagram";
        nodeIdField: string;
        nodeLabelField: string;
        nodeLayerField: string;
        edgeSourceField: string;
        edgeTargetField: string;
        edgeLabelField?: string;
      };
}

export interface VisualRenderManifest {
  schema: "longtable.visual-render-manifest";
  version: 1;
  runId: string;
  contractId: string;
  renderer: AllowlistedVisualRenderer;
  rendererVersion: "1";
  renderedAt: string;
  dataSnapshotPath: string;
  dataSnapshotHash: string;
  requestHash: string;
  editableSourcePath: string;
  editableSourceHash: string;
  exportPaths: string[];
  placementManifestPath: string;
  widthPx: number;
  heightPx: number;
}

export interface MechanicalVisualQa {
  schema: "longtable.mechanical-visual-qa";
  version: 1;
  runId: string;
  contractId: string;
  renderer: AllowlistedVisualRenderer;
  checkedAt: string;
  passed: boolean;
  hardFailures: string[];
  warnings: string[];
  checks: {
    outputExists: boolean;
    deterministicHashPresent: boolean;
    noActiveContent: boolean;
    declaredDimensions: boolean;
    minimumFontSize: boolean;
    directLabelsPresent: boolean;
    dataSnapshotBound: boolean;
  };
}

type DataRow = Record<string, unknown>;

function sha256(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function xml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function assertWithin(parent: string, child: string): void {
  const root = resolve(parent);
  const target = resolve(child);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error("Visual renderer output escaped its run directory.");
  }
}

function finiteNumber(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`Visual data field ${field} must be numeric.`);
  return number;
}

function textElement(x: number, y: number, value: unknown, options?: {
  anchor?: "start" | "middle" | "end";
  size?: number;
  weight?: number;
  rotate?: number;
}): string {
  const transform = options?.rotate ? ` transform="rotate(${options.rotate} ${x} ${y})"` : "";
  return `<text x="${x}" y="${y}" text-anchor="${options?.anchor ?? "start"}" font-size="${options?.size ?? 12}" font-weight="${options?.weight ?? 400}" stroke="none"${transform}>${xml(value)}</text>`;
}

function svgShell(input: {
  width: number;
  height: number;
  title: string;
  description: string;
  body: string;
}): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}">`,
    `<title id="title">${xml(input.title)}</title>`,
    `<desc id="desc">${xml(input.description)}</desc>`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<g font-family="Arial, Helvetica, sans-serif" fill="#111111" stroke="#111111">`,
    input.body,
    "</g>",
    "</svg>",
    ""
  ].join("\n");
}

function renderTable(contract: VisualEvidenceContract, request: VisualRenderRequest, rows: DataRow[]): string {
  if (request.specification.kind !== "table") throw new Error("Table contract requires a table specification.");
  const columns = request.specification.columns;
  if (columns.length === 0) throw new Error("Table renderer requires at least one column.");
  const maxRows = Math.max(1, Math.min(30, request.specification.maxRows ?? 15));
  const visibleRows = rows.slice(0, maxRows);
  const margin = 24;
  const captionHeight = 52;
  const rowHeight = 25;
  const columnWidth = (request.widthPx - margin * 2) / columns.length;
  const body: string[] = [
    textElement(margin, 24, contract.analyticalQuestion, { size: 13, weight: 700 }),
    textElement(margin, 43, `Denominator: ${contract.dataContract.denominator}`, { size: 9 })
  ];
  const top = captionHeight;
  body.push(`<line x1="${margin}" y1="${top}" x2="${request.widthPx - margin}" y2="${top}" stroke-width="1.5"/>`);
  columns.forEach((column, index) => {
    const x = margin + index * columnWidth + (column.align === "right" ? columnWidth - 4 : 4);
    body.push(textElement(x, top + 17, column.label, {
      anchor: column.align === "right" ? "end" : "start",
      size: 10,
      weight: 700
    }));
  });
  body.push(`<line x1="${margin}" y1="${top + rowHeight}" x2="${request.widthPx - margin}" y2="${top + rowHeight}" stroke-width="1"/>`);
  visibleRows.forEach((row, rowIndex) => {
    const y = top + rowHeight * (rowIndex + 1) + 17;
    columns.forEach((column, columnIndex) => {
      const x = margin + columnIndex * columnWidth + (column.align === "right" ? columnWidth - 4 : 4);
      body.push(textElement(x, y, row[column.field], {
        anchor: column.align === "right" ? "end" : "start",
        size: 9
      }));
    });
    body.push(`<line x1="${margin}" y1="${y + 7}" x2="${request.widthPx - margin}" y2="${y + 7}" stroke="#cccccc" stroke-width="0.5"/>`);
  });
  if (rows.length > visibleRows.length) {
    body.push(textElement(margin, request.heightPx - 10, `${rows.length - visibleRows.length} additional rows belong in the supplement.`, { size: 8 }));
  }
  return svgShell({
    width: request.widthPx,
    height: request.heightPx,
    title: contract.readerTakeaway,
    description: contract.accessibility?.textAlternative ?? contract.readerTakeaway,
    body: body.join("\n")
  });
}

function renderFigure(contract: VisualEvidenceContract, request: VisualRenderRequest, rows: DataRow[]): string {
  if (request.specification.kind !== "figure") throw new Error("Figure contract requires a figure specification.");
  const spec = request.specification;
  if (rows.length === 0) throw new Error("Figure renderer requires at least one data row.");
  const margin = { top: 54, right: 24, bottom: 58, left: 68 };
  if (spec.orientation === "horizontal") {
    if (spec.mark !== "bar") throw new Error("Horizontal figures currently require bar marks.");
    const left = Math.min(300, Math.max(150, Math.floor(request.widthPx * 0.34)));
    const right = 90;
    const top = 70;
    const bottom = 42;
    const plotWidth = request.widthPx - left - right;
    const plotHeight = request.heightPx - top - bottom;
    const domain = contract.axis?.domain ?? [0, Math.max(...rows.map((row) => finiteNumber(row[spec.yField], spec.yField))) || 1];
    if (domain[0] !== 0) throw new Error("Horizontal bar figures require a zero baseline.");
    const seriesValues = spec.seriesField
      ? [...new Set(rows.map((row) => String(row[spec.seriesField!] ?? "")))]
      : [];
    const panelGap = seriesValues.length > 1 ? 22 : 0;
    const rowStep = (plotHeight - panelGap * seriesValues.length) / rows.length;
    if (rowStep < 18) throw new Error("Horizontal bar rows are too dense for the approved output size.");
    const body: string[] = [
      textElement(20, 23, contract.analyticalQuestion, { size: 11, weight: 700 }),
      textElement(20, 42, `Denominator: ${contract.dataContract.denominator}`, { size: 9 }),
      `<line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke-width="1"/>`,
      `<line x1="${left}" y1="${top + plotHeight}" x2="${left + plotWidth}" y2="${top + plotHeight}" stroke-width="1"/>`
    ];
    let priorSeries: string | undefined;
    let encounteredSeries = 0;
    rows.forEach((row, index) => {
      const value = finiteNumber(row[spec.yField], spec.yField);
      if (value < domain[0] || value > domain[1]) throw new Error("Figure data falls outside the approved axis domain.");
      const series = spec.seriesField ? String(row[spec.seriesField] ?? "") : undefined;
      const isNewSeries = Boolean(series && series !== priorSeries);
      if (isNewSeries) encounteredSeries += 1;
      const centerY = top + encounteredSeries * panelGap + (index + 0.5) * rowStep;
      if (series && series !== priorSeries) {
        if (priorSeries) {
          const dividerY = centerY - rowStep / 2 - panelGap / 2;
          body.push(`<line x1="${left}" y1="${dividerY}" x2="${request.widthPx - 20}" y2="${dividerY}" stroke="#999999" stroke-width="0.7"/>`);
        }
        body.push(textElement(20, centerY - rowStep / 2 - 6, series, { size: 8, weight: 700 }));
        priorSeries = series;
      }
      const width = (value - domain[0]) / (domain[1] - domain[0]) * plotWidth;
      body.push(textElement(left - 8, centerY + 3, row[spec.xField], { anchor: "end", size: 8 }));
      body.push(`<rect x="${left}" y="${centerY - Math.min(7, rowStep * 0.28)}" width="${width}" height="${Math.min(14, rowStep * 0.56)}" fill="#777777" stroke="none"/>`);
      let label = String(value);
      if (spec.directLabel === "fraction_percent") {
        if (!spec.denominatorField) throw new Error("fraction_percent labels require denominatorField.");
        const denominator = finiteNumber(row[spec.denominatorField], spec.denominatorField);
        label = `${value}/${denominator} (${(value / denominator * 100).toFixed(1)}%)`;
      }
      body.push(textElement(Math.min(left + width + 6, request.widthPx - right + 4), centerY + 3, label, { size: 8, weight: 700 }));
    });
    for (let tick = 0; tick <= 4; tick += 1) {
      const value = domain[0] + (domain[1] - domain[0]) * tick / 4;
      const tickX = left + plotWidth * tick / 4;
      body.push(`<line x1="${tickX}" y1="${top}" x2="${tickX}" y2="${top + plotHeight}" stroke="#dddddd" stroke-width="0.5"/>`);
      body.push(textElement(tickX, top + plotHeight + 15, Number(value.toPrecision(3)), { anchor: "middle", size: 8 }));
    }
    body.push(textElement(left + plotWidth / 2, request.heightPx - 8, spec.yLabel, { anchor: "middle", size: 9, weight: 700 }));
    return svgShell({
      width: request.widthPx,
      height: request.heightPx,
      title: contract.readerTakeaway,
      description: contract.accessibility?.textAlternative ?? contract.readerTakeaway,
      body: body.join("\n")
    });
  }
  const plotWidth = request.widthPx - margin.left - margin.right;
  const plotHeight = request.heightPx - margin.top - margin.bottom;
  const yValues = rows.map((row) => finiteNumber(row[spec.yField], spec.yField));
  const domain = contract.axis?.domain ?? [0, Math.max(...yValues) * 1.08 || 1];
  if (spec.mark === "bar" && domain[0] !== 0) {
    throw new Error("Bar figures require a zero baseline.");
  }
  if (yValues.some((value) => value < domain[0] || value > domain[1])) {
    throw new Error("Figure data falls outside the approved axis domain.");
  }
  const xValues = rows.map((row) => String(row[spec.xField] ?? ""));
  const x = (index: number): number => margin.left + ((index + 0.5) / rows.length) * plotWidth;
  const y = (value: number): number => margin.top + plotHeight -
    ((value - domain[0]) / (domain[1] - domain[0])) * plotHeight;
  const body: string[] = [
    textElement(margin.left, 22, contract.analyticalQuestion, { size: 13, weight: 700 }),
    textElement(margin.left, 40, `Denominator: ${contract.dataContract.denominator}`, { size: 9 }),
    `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke-width="1"/>`,
    `<line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}" stroke-width="1"/>`
  ];
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = domain[0] + (domain[1] - domain[0]) * tick / 4;
    const tickY = y(value);
    body.push(`<line x1="${margin.left}" y1="${tickY}" x2="${margin.left + plotWidth}" y2="${tickY}" stroke="#dddddd" stroke-width="0.5"/>`);
    body.push(textElement(margin.left - 7, tickY + 3, Number(value.toPrecision(3)), { anchor: "end", size: 8 }));
  }
  if (spec.mark === "bar") {
    const barWidth = Math.max(4, plotWidth / rows.length * 0.58);
    rows.forEach((row, index) => {
      const value = yValues[index];
      const top = y(value);
      body.push(`<rect x="${x(index) - barWidth / 2}" y="${top}" width="${barWidth}" height="${margin.top + plotHeight - top}" fill="#777777" stroke="none"/>`);
      body.push(textElement(x(index), top - 5, value, { anchor: "middle", size: 8, weight: 700 }));
    });
  } else {
    if (spec.mark === "line") {
      const points = yValues.map((value, index) => `${x(index)},${y(value)}`).join(" ");
      body.push(`<polyline points="${points}" fill="none" stroke="#222222" stroke-width="1.5"/>`);
    }
    rows.forEach((row, index) => {
      const value = yValues[index];
      body.push(`<circle cx="${x(index)}" cy="${y(value)}" r="3.5" fill="#ffffff" stroke-width="1.5"/>`);
      body.push(textElement(x(index), y(value) - 7, value, { anchor: "middle", size: 8, weight: 700 }));
    });
  }
  xValues.forEach((value, index) => {
    body.push(textElement(x(index), margin.top + plotHeight + 17, value, { anchor: "middle", size: 8 }));
  });
  body.push(textElement(margin.left + plotWidth / 2, request.heightPx - 10, spec.xLabel, { anchor: "middle", size: 9, weight: 700 }));
  body.push(textElement(14, margin.top + plotHeight / 2, spec.yLabel, { anchor: "middle", size: 9, weight: 700, rotate: -90 }));
  return svgShell({
    width: request.widthPx,
    height: request.heightPx,
    title: contract.readerTakeaway,
    description: contract.accessibility?.textAlternative ?? contract.readerTakeaway,
    body: body.join("\n")
  });
}

function renderDiagram(contract: VisualEvidenceContract, request: VisualRenderRequest, snapshot: unknown): string {
  if (request.specification.kind !== "diagram") throw new Error("Diagram contract requires a diagram specification.");
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("Diagram snapshot must contain nodes and edges arrays.");
  }
  const record = snapshot as Record<string, unknown>;
  const nodes = Array.isArray(record.nodes) ? record.nodes as DataRow[] : [];
  const edges = Array.isArray(record.edges) ? record.edges as DataRow[] : [];
  if (nodes.length === 0) throw new Error("Diagram renderer requires at least one node.");
  const spec = request.specification;
  const performed = nodes.filter((node) => String(node[spec.nodeLayerField]) === "performed");
  const proposed = nodes.filter((node) => String(node[spec.nodeLayerField]) === "proposed");
  if (nodes.length !== performed.length + proposed.length) {
    throw new Error("Every diagram node must be explicitly labeled performed or proposed.");
  }
  const positions = new Map<string, { x: number; y: number }>();
  const body: string[] = [
    textElement(24, 24, contract.analyticalQuestion, { size: 13, weight: 700 }),
    textElement(request.widthPx * 0.25, 48, "Performed", { anchor: "middle", size: 10, weight: 700 }),
    textElement(request.widthPx * 0.75, 48, "Proposed", { anchor: "middle", size: 10, weight: 700 }),
    `<line x1="${request.widthPx / 2}" y1="38" x2="${request.widthPx / 2}" y2="${request.heightPx - 18}" stroke="#999999" stroke-dasharray="5 4"/>`
  ];
  function place(layer: DataRow[], x: number): void {
    layer.forEach((node, index) => {
      const y = 80 + index * Math.max(54, (request.heightPx - 110) / Math.max(1, layer.length));
      const id = String(node[spec.nodeIdField]);
      positions.set(id, { x, y });
    });
  }
  place(performed, request.widthPx * 0.25);
  place(proposed, request.widthPx * 0.75);
  for (const edge of edges) {
    const source = positions.get(String(edge[spec.edgeSourceField]));
    const target = positions.get(String(edge[spec.edgeTargetField]));
    if (!source || !target) throw new Error("Diagram edge references an unknown node.");
    body.push(`<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke-width="1.2" marker-end="url(#arrow)"/>`);
    if (spec.edgeLabelField && edge[spec.edgeLabelField]) {
      body.push(textElement((source.x + target.x) / 2, (source.y + target.y) / 2 - 4, edge[spec.edgeLabelField], { anchor: "middle", size: 8 }));
    }
  }
  body.unshift(`<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#111111"/></marker></defs>`);
  for (const node of nodes) {
    const id = String(node[spec.nodeIdField]);
    const position = positions.get(id)!;
    body.push(`<rect x="${position.x - 72}" y="${position.y - 18}" width="144" height="36" rx="4" fill="#ffffff" stroke-width="1.2"/>`);
    body.push(textElement(position.x, position.y + 4, node[spec.nodeLabelField], { anchor: "middle", size: 9, weight: 700 }));
  }
  return svgShell({
    width: request.widthPx,
    height: request.heightPx,
    title: contract.readerTakeaway,
    description: contract.accessibility?.textAlternative ?? contract.readerTakeaway,
    body: body.join("\n")
  });
}

async function readSnapshot(path: string): Promise<{ raw: Buffer; parsed: unknown; rows: DataRow[] }> {
  const raw = await readFile(path);
  const parsed = JSON.parse(raw.toString("utf8")) as unknown;
  const rows = Array.isArray(parsed)
    ? parsed as DataRow[]
    : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).rows)
      ? (parsed as { rows: DataRow[] }).rows
      : [];
  return { raw, parsed, rows };
}

export async function renderVisualArtifact(input: {
  runDir: string;
  contract: VisualEvidenceContract;
  request: VisualRenderRequest;
}): Promise<{ manifest: VisualRenderManifest; manifestPath: string; qa: MechanicalVisualQa; qaPath: string }> {
  if (input.contract.status !== "approved" || !input.contract.approval) {
    throw new Error("Visual rendering requires a human-approved contract.");
  }
  if (input.request.schema !== "longtable.visual-render-request" || input.request.version !== 1 ||
      input.request.contractId !== input.contract.id ||
      input.request.renderer !== "longtable-svg-v1") {
    throw new Error("Invalid or non-allowlisted visual render request.");
  }
  if (input.request.specification.kind !== input.contract.kind) {
    throw new Error("Render request kind does not match the approved contract.");
  }
  if (input.contract.output.renderer !== input.request.renderer ||
      input.contract.output.rendererVersion !== "1" ||
      input.contract.output.editableSourceFormat !== "svg") {
    throw new Error("Approved contract does not authorize longtable-svg-v1 editable SVG output.");
  }
  if (!Number.isInteger(input.request.widthPx) || !Number.isInteger(input.request.heightPx) ||
      input.request.widthPx < 320 || input.request.widthPx > 2400 ||
      input.request.heightPx < 220 || input.request.heightPx > 2400) {
    throw new Error("Visual dimensions must be integer pixels within the allowlisted range.");
  }
  const snapshotPath = resolve(input.contract.dataContract.dataSnapshotPath);
  const snapshot = await readSnapshot(snapshotPath);
  const outputDirectory = join(resolve(input.runDir), "artifacts", "visuals", input.contract.id);
  assertWithin(input.runDir, outputDirectory);
  await mkdir(outputDirectory, { recursive: true });
  const svg = input.contract.kind === "table"
    ? renderTable(input.contract, input.request, snapshot.rows)
    : input.contract.kind === "figure"
      ? renderFigure(input.contract, input.request, snapshot.rows)
      : renderDiagram(input.contract, input.request, snapshot.parsed);
  const editableSourcePath = join(outputDirectory, `${input.contract.id}.svg`);
  await writeFile(editableSourcePath, svg, "utf8");
  const placementManifestPath = join(outputDirectory, "placement.json");
  await writeFile(placementManifestPath, `${JSON.stringify({
    schema: "longtable.visual-placement-manifest",
    version: 1,
    contractId: input.contract.id,
    firstInterpretiveClaimId: input.contract.manuscriptClaimIds[0],
    mainTextRole: input.contract.mainTextRole,
    supplementRole: input.contract.supplementRole,
    prohibitedInferences: input.contract.evidenceBoundary.prohibitedInferences,
    leadIn: {
      question: input.contract.analyticalQuestion,
      pattern: input.contract.readerTakeaway,
      prohibitedInference: input.contract.evidenceBoundary.prohibitedInferences[0] ?? "none"
    }
  }, null, 2)}\n`, "utf8");
  const manifest: VisualRenderManifest = {
    schema: "longtable.visual-render-manifest",
    version: 1,
    runId: input.request.runId,
    contractId: input.contract.id,
    renderer: input.request.renderer,
    rendererVersion: "1",
    renderedAt: new Date().toISOString(),
    dataSnapshotPath: snapshotPath,
    dataSnapshotHash: sha256(snapshot.raw),
    requestHash: sha256(JSON.stringify(input.request)),
    editableSourcePath,
    editableSourceHash: sha256(svg),
    exportPaths: [editableSourcePath],
    placementManifestPath,
    widthPx: input.request.widthPx,
    heightPx: input.request.heightPx
  };
  const manifestPath = join(outputDirectory, "render-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const qa = await verifyRenderedVisual({ contract: input.contract, manifest });
  const qaPath = join(outputDirectory, "mechanical-qa.json");
  await writeFile(qaPath, `${JSON.stringify(qa, null, 2)}\n`, "utf8");
  return { manifest, manifestPath, qa, qaPath };
}

export async function verifyRenderedVisual(input: {
  contract: VisualEvidenceContract;
  manifest: VisualRenderManifest;
}): Promise<MechanicalVisualQa> {
  const hardFailures: string[] = [];
  const warnings: string[] = [];
  let svg = "";
  try {
    svg = await readFile(input.manifest.editableSourcePath, "utf8");
  } catch {
    hardFailures.push("Editable visual output is missing or unreadable.");
  }
  const noActiveContent = !/<script\b|javascript:|<foreignObject\b|(?:href|xlink:href)=["']https?:\/\//i.test(svg);
  if (!noActiveContent) hardFailures.push("SVG contains active or external content.");
  const declaredDimensions = svg.includes(`width="${input.manifest.widthPx}"`) &&
    svg.includes(`height="${input.manifest.heightPx}"`) &&
    svg.includes(`viewBox="0 0 ${input.manifest.widthPx} ${input.manifest.heightPx}"`);
  if (!declaredDimensions) hardFailures.push("SVG dimensions do not match the render manifest.");
  const fontSizes = [...svg.matchAll(/font-size="([0-9.]+)"/g)].map((match) => Number(match[1]));
  const minimumFontSize = fontSizes.length > 0 &&
    Math.min(...fontSizes) >= (input.contract.accessibility?.minimumFontSizePt ?? 7);
  if (!minimumFontSize) hardFailures.push("Rendered text falls below the approved minimum font size.");
  const directLabelsPresent = !input.contract.directLabels || /<text\b/.test(svg);
  if (!directLabelsPresent) hardFailures.push("Approved direct labels are absent.");
  const deterministicHashPresent = input.manifest.dataSnapshotHash.startsWith("sha256:") &&
    input.manifest.requestHash.startsWith("sha256:") &&
    input.manifest.editableSourceHash.startsWith("sha256:") &&
    (svg ? sha256(svg) === input.manifest.editableSourceHash : false);
  if (!deterministicHashPresent) hardFailures.push("Render provenance hashes are missing.");
  let dataSnapshotBound = false;
  try {
    const snapshot = await readFile(input.manifest.dataSnapshotPath);
    dataSnapshotBound = sha256(snapshot) === input.manifest.dataSnapshotHash;
  } catch {
    dataSnapshotBound = false;
  }
  if (!dataSnapshotBound) hardFailures.push("Rendered output is not bound to a data snapshot.");
  if (basename(input.manifest.editableSourcePath) !== `${input.contract.id}.svg`) {
    warnings.push("Editable source filename differs from the contract ID.");
  }
  return {
    schema: "longtable.mechanical-visual-qa",
    version: 1,
    runId: input.manifest.runId,
    contractId: input.manifest.contractId,
    renderer: input.manifest.renderer,
    checkedAt: new Date().toISOString(),
    passed: hardFailures.length === 0,
    hardFailures,
    warnings,
    checks: {
      outputExists: Boolean(svg),
      deterministicHashPresent,
      noActiveContent,
      declaredDimensions,
      minimumFontSize,
      directLabelsPresent,
      dataSnapshotBound
    }
  };
}
