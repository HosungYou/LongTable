import { createHash } from "node:crypto";
import type {
  CapabilityResult,
  InstitutionalResearchCapability,
  InstitutionalResearchHardStop
} from "./workflow-types.js";

export interface BrowserAccessibilityElement {
  readonly role: string;
  readonly name: string;
  readonly value: string;
}

export interface BrowserPageSnapshot {
  readonly url: string;
  readonly title: string;
  readonly authenticated: boolean;
  readonly text: string;
  readonly elements: readonly BrowserAccessibilityElement[];
}

export interface BrowserSignatureLandmark {
  readonly role: string;
  readonly name: string;
}

export interface BrowserSignatureProfile {
  readonly databaseId: string;
  readonly pageKind: string;
  readonly titlePattern: string;
  readonly requiredLandmarks: readonly BrowserSignatureLandmark[];
}

export interface BrowserPageSignature {
  readonly hash: string;
  readonly compatible: boolean;
  readonly missingLandmarks: readonly BrowserSignatureLandmark[];
}

export interface SemanticBrowserSelector {
  readonly role: string;
  readonly name: string;
}

export interface CoordinateFallback {
  readonly x: number;
  readonly y: number;
  readonly requiredSignatureHash: string;
}

export interface BrowserRecipeStep {
  readonly capability: InstitutionalResearchCapability;
  readonly selector?: SemanticBrowserSelector;
  readonly coordinateFallback?: CoordinateFallback;
}

export interface BrowserRecipe {
  readonly id: string;
  readonly version: string;
  readonly databaseId: string;
  readonly pageKind: string;
  readonly approvedSignatureHash: string;
  readonly productionEligible: boolean;
  readonly steps: readonly BrowserRecipeStep[];
}

export interface BrowserReplayOptions {
  readonly mode: "calibration" | "pilot" | "production";
  readonly resultCap: number;
}

export interface BrowserReplayAction {
  readonly capability: InstitutionalResearchCapability;
  readonly selector?: SemanticBrowserSelector;
  readonly coordinateFallback?: CoordinateFallback;
}

export interface BrowserReplayResult {
  readonly status: "ready" | "blocked";
  readonly actions: readonly BrowserReplayAction[];
  readonly observations: { readonly resultCount?: number };
  readonly hardStop?: Extract<CapabilityResult<never>, { status: "hard_stop" }>;
}

export interface DownloadObservation {
  readonly filename: string;
  readonly mimeType: string;
}

export interface DownloadPattern {
  readonly filenamePattern: RegExp;
  readonly mimeTypes: readonly string[];
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'");
}

function cleanText(value: string): string {
  return decodeEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attribute(attributes: string, name: string): string | undefined {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? decodeEntities(match[1]).trim() : undefined;
}

function implicitRole(tag: string, attributes: string): string | undefined {
  const explicit = attribute(attributes, "role");
  if (explicit) return explicit.toLowerCase();
  if (/^h[1-6]$/i.test(tag)) return "heading";
  if (tag.toLowerCase() === "button") return "button";
  if (tag.toLowerCase() === "select") return "combobox";
  if (tag.toLowerCase() === "input") return "textbox";
  return undefined;
}

function accessibleElements(html: string): BrowserAccessibilityElement[] {
  const elements: BrowserAccessibilityElement[] = [];
  const tags = ["button", "h1", "h2", "h3", "h4", "h5", "h6", "div", "span", "select", "input"];
  for (const tag of tags) {
    const paired = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "gi");
    for (const match of html.matchAll(paired)) {
      const role = implicitRole(tag, match[1]);
      if (!role) continue;
      const name = attribute(match[1], "aria-label") ?? cleanText(match[2]);
      if (!name) continue;
      elements.push({ role, name, value: cleanText(match[2]) });
    }
    if (tag === "input") {
      const single = /<input\b([^>]*)\/?\s*>/gi;
      for (const match of html.matchAll(single)) {
        const role = implicitRole(tag, match[1]);
        const name = attribute(match[1], "aria-label") ?? attribute(match[1], "name") ?? attribute(match[1], "type") ?? "input";
        if (role) elements.push({ role, name, value: attribute(match[1], "value") ?? "" });
      }
    }
  }
  return elements.sort((left, right) =>
    left.role.localeCompare(right.role) || left.name.localeCompare(right.name) || left.value.localeCompare(right.value)
  );
}

export function buildBrowserPageSnapshot(input: { readonly url: string; readonly html: string }): BrowserPageSnapshot {
  const title = cleanText(input.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const authenticated = /data-authenticated\s*=\s*["']true["']/i.test(input.html) || /aria-label\s*=\s*["']Authenticated institution["']/i.test(input.html);
  return {
    url: input.url,
    title,
    authenticated,
    text: cleanText(input.html),
    elements: accessibleElements(input.html)
  };
}

function structuralHash(snapshot: BrowserPageSnapshot): string {
  const parsedUrl = new URL(snapshot.url);
  const canonical = {
    origin: parsedUrl.origin,
    path: parsedUrl.pathname.replace(/\/+$/, "") || "/",
    title: snapshot.title,
    authenticated: snapshot.authenticated,
    elements: snapshot.elements.map(({ role, name, value }) => ({ role, name, value }))
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function hasLandmark(snapshot: BrowserPageSnapshot, landmark: BrowserSignatureLandmark): boolean {
  return snapshot.elements.some((element) =>
    element.role.toLowerCase() === landmark.role.toLowerCase() &&
    element.name.toLowerCase() === landmark.name.toLowerCase()
  );
}

export function computeBrowserPageSignature(
  snapshot: BrowserPageSnapshot,
  profile: BrowserSignatureProfile
): BrowserPageSignature {
  const missingLandmarks = profile.requiredLandmarks.filter((landmark) => !hasLandmark(snapshot, landmark));
  const titleCompatible = snapshot.title.toLowerCase().includes(profile.titlePattern.toLowerCase());
  return {
    hash: structuralHash(snapshot),
    compatible: titleCompatible && missingLandmarks.length === 0,
    missingLandmarks
  };
}

export function validateBrowserRecipe(recipe: BrowserRecipe): string[] {
  const issues: string[] = [];
  if (!recipe.id.trim() || !recipe.version.trim() || !recipe.databaseId.trim()) {
    issues.push("Browser recipe requires stable id, version, and database id.");
  }
  if (!/^[a-f0-9]{64}$/i.test(recipe.approvedSignatureHash)) {
    issues.push("Browser recipe requires an approved SHA-256 page signature.");
  }
  for (const [index, step] of recipe.steps.entries()) {
    if (!step.selector && !step.coordinateFallback) {
      issues.push(`Browser recipe step ${index + 1} needs a semantic selector or bounded coordinate fallback.`);
    }
    if (step.coordinateFallback && step.coordinateFallback.requiredSignatureHash !== recipe.approvedSignatureHash) {
      issues.push(`Browser recipe step ${index + 1} coordinate fallback signature must match the approved page signature.`);
    }
  }
  return issues;
}

function hardStop(code: InstitutionalResearchHardStop, reason: string): Extract<CapabilityResult<never>, { status: "hard_stop" }> {
  return { status: "hard_stop", code, reason };
}

function detectedBlocker(snapshot: BrowserPageSnapshot): Extract<CapabilityResult<never>, { status: "hard_stop" }> | undefined {
  const text = snapshot.text.toLowerCase();
  if (/session expired|session has expired|timed out/.test(text)) {
    return hardStop("SESSION_EXPIRED", "The authenticated database session expired.");
  }
  if (/multi-factor|verification code|captcha|verify you are human/.test(text)) {
    return hardStop("MFA_OR_CAPTCHA_REQUIRED", "Researcher action is required for MFA or CAPTCHA.");
  }
  if (/updated terms|terms of use|accept.*terms/.test(text)) {
    return hardStop("TERMS_OR_ACCESS_UNCLEAR", "Terms or access conditions require researcher review.");
  }
  if (/type=['\"]password|\bsign in\b|\blog in\b/.test(text)) {
    return hardStop("LOGIN_REQUIRED", "The researcher must complete database login.");
  }
  return undefined;
}

function elementForSelector(
  snapshot: BrowserPageSnapshot,
  selector: SemanticBrowserSelector
): BrowserAccessibilityElement | undefined {
  return snapshot.elements.find((element) =>
    element.role.toLowerCase() === selector.role.toLowerCase() &&
    element.name.toLowerCase() === selector.name.toLowerCase()
  );
}

function parseResultCount(value: string): number | undefined {
  const match = value.match(/[\d,]+/);
  return match ? Number(match[0].replace(/,/g, "")) : undefined;
}

export function replayBrowserRecipe(
  recipe: BrowserRecipe,
  snapshot: BrowserPageSnapshot,
  options: BrowserReplayOptions
): BrowserReplayResult {
  const blocker = detectedBlocker(snapshot);
  if (blocker) return { status: "blocked", actions: [], observations: {}, hardStop: blocker };
  if (options.mode === "production" && !recipe.productionEligible) {
    return { status: "blocked", actions: [], observations: {}, hardStop: hardStop("UI_SIGNATURE_CHANGED", "Exploration recipes are calibration/pilot-only and cannot run in production.") };
  }
  const currentHash = structuralHash(snapshot);
  if (currentHash !== recipe.approvedSignatureHash) {
    return { status: "blocked", actions: [], observations: {}, hardStop: hardStop("UI_SIGNATURE_CHANGED", "The current accessibility page signature differs from the approved browser recipe.") };
  }
  const actions: BrowserReplayAction[] = [];
  let resultCount: number | undefined;
  for (const step of recipe.steps) {
    const element = step.selector ? elementForSelector(snapshot, step.selector) : undefined;
    if (step.selector && !element && !step.coordinateFallback) {
      return { status: "blocked", actions, observations: {}, hardStop: hardStop("UI_SIGNATURE_CHANGED", `Required control ${step.selector.role}:${step.selector.name} was not found.`) };
    }
    if (step.coordinateFallback && step.coordinateFallback.requiredSignatureHash !== currentHash) {
      return { status: "blocked", actions, observations: {}, hardStop: hardStop("UI_SIGNATURE_CHANGED", "Coordinate fallback is not authorized for the current page signature.") };
    }
    actions.push({
      capability: step.capability,
      ...(step.selector ? { selector: step.selector } : {}),
      ...(step.coordinateFallback ? { coordinateFallback: step.coordinateFallback } : {})
    });
    if (step.capability === "readResultCount" && element) {
      resultCount = parseResultCount(element.value);
    }
  }
  if (resultCount !== undefined && resultCount > options.resultCap) {
    return {
      status: "blocked",
      actions,
      observations: { resultCount },
      hardStop: hardStop("DATABASE_RESULT_CAP_REACHED", `Observed ${resultCount} results, above the approved cap ${options.resultCap}.`)
    };
  }
  return { status: "ready", actions, observations: { ...(resultCount !== undefined ? { resultCount } : {}) } };
}

function normalizedQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function verifySubmittedQuery(expected: string, observed: string): CapabilityResult<string> {
  return normalizedQuery(expected) === normalizedQuery(observed)
    ? { status: "supported", value: observed }
    : hardStop("QUERY_DRIFT_DETECTED", "The submitted database query differs from the frozen protocol query.");
}

export function verifyExportObservation(expectedCount: number, parsedCount: number): CapabilityResult<number> {
  return expectedCount === parsedCount
    ? { status: "supported", value: parsedCount }
    : hardStop("EXPORT_COUNT_MISMATCH", `Database reported ${expectedCount} records but the export parser recovered ${parsedCount}.`);
}

export function verifyDownloadPattern(
  observed: DownloadObservation,
  expected: DownloadPattern
): CapabilityResult<DownloadObservation> {
  expected.filenamePattern.lastIndex = 0;
  const filenameMatches = expected.filenamePattern.test(observed.filename);
  const mimeMatches = expected.mimeTypes.includes(observed.mimeType);
  return filenameMatches && mimeMatches
    ? { status: "supported", value: observed }
    : hardStop("DOWNLOAD_PATTERN_CHANGED", `Observed download ${observed.filename} (${observed.mimeType}) does not match the approved pattern.`);
}
