import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { ApprovedManuscript } from "./manuscript.js";
import type { WordRenderProfile } from "./render-profiles.js";

export interface WordRenderInput {
  readonly manuscript: ApprovedManuscript;
  readonly profile: WordRenderProfile;
  readonly outputPath: string;
  readonly pythonExecutable?: string;
}

export interface WordRenderResult {
  readonly outputPath: string;
  readonly contentSha256: string;
  readonly profileId: string;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, stable(entry)]));
  }
  return value;
}

export function renderWordManuscript(input: WordRenderInput): WordRenderResult {
  const here = dirname(fileURLToPath(import.meta.url));
  const renderer = resolve(here, "..", "resources", "render_word.py");
  if (!existsSync(renderer)) throw new Error(`DOCX renderer resource is missing: ${renderer}`);
  if (input.profile.templatePath) {
    if (!existsSync(input.profile.templatePath)) throw new Error(`User-supplied DOCX template does not exist: ${input.profile.templatePath}`);
    const actualTemplateSha256 = createHash("sha256").update(readFileSync(input.profile.templatePath)).digest("hex");
    if (actualTemplateSha256 !== input.profile.templateSha256) throw new Error("User-supplied DOCX template hash does not match the validated render profile.");
  }
  const payload = JSON.stringify(stable({ manuscript: input.manuscript, profile: input.profile }));
  const result = spawnSync(input.pythonExecutable ?? "python3", [renderer, input.outputPath], { input: payload, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`DOCX rendering failed: ${(result.stderr || result.stdout || "unknown renderer error").trim()}`);
  return {
    outputPath: input.outputPath,
    contentSha256: createHash("sha256").update(payload).digest("hex"),
    profileId: input.profile.id
  };
}
