export interface WordRenderProfile {
  readonly id: string;
  readonly label: string;
  readonly version: number;
  readonly status: "verified" | "provisional_until_journal_rules_verified";
  readonly sourceBasis: string;
  readonly page: {
    readonly size: "Letter" | "A4";
    readonly marginInches: number;
    readonly headerInches: number;
    readonly footerInches: number;
  };
  readonly body: {
    readonly latinFont: string;
    readonly eastAsiaFont: string;
    readonly fontSizePt: number;
    readonly lineSpacing: number;
    readonly paragraphAfterPt: number;
    readonly firstLineIndentInches: number;
  };
  readonly references: {
    readonly hangingIndentInches: number;
  };
  readonly pageNumber: "top_right" | "bottom_center";
  readonly titlePage: boolean;
  readonly templatePath?: string;
  readonly templateSha256?: string;
}

function positive(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive number.`);
  return value;
}

export function validateRenderProfile(input: unknown): WordRenderProfile {
  if (!input || typeof input !== "object") throw new Error("Render profile must be an object.");
  const profile = input as Partial<WordRenderProfile>;
  if (!profile.id?.trim() || !profile.label?.trim() || !profile.sourceBasis?.trim()) throw new Error("Render profile id, label, and source basis are required.");
  if (!Number.isInteger(profile.version) || (profile.version ?? 0) < 1) throw new Error("Render profile version must be a positive integer.");
  if (!profile.page || !["Letter", "A4"].includes(profile.page.size)) throw new Error("Render profile page size must be Letter or A4.");
  positive(profile.page.marginInches, "Render profile margin");
  positive(profile.page.headerInches, "Render profile header distance");
  positive(profile.page.footerInches, "Render profile footer distance");
  if (!profile.body?.latinFont?.trim() || !profile.body.eastAsiaFont?.trim()) throw new Error("Render profile body fonts are required.");
  positive(profile.body.fontSizePt, "Render profile font size");
  positive(profile.body.lineSpacing, "Render profile line spacing");
  if (typeof profile.body.paragraphAfterPt !== "number" || profile.body.paragraphAfterPt < 0) throw new Error("Render profile paragraph spacing must be non-negative.");
  if (typeof profile.body.firstLineIndentInches !== "number" || profile.body.firstLineIndentInches < 0) throw new Error("Render profile first-line indent must be non-negative.");
  positive(profile.references?.hangingIndentInches, "Render profile reference hanging indent");
  if (!profile.templatePath && profile.templateSha256) throw new Error("A template hash requires a user-supplied template path.");
  if (profile.templatePath && !/^[a-f0-9]{64}$/.test(profile.templateSha256 ?? "")) throw new Error("A user-supplied template profile requires a SHA-256 hash.");
  return JSON.parse(JSON.stringify(profile)) as WordRenderProfile;
}

