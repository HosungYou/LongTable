export const LAWFUL_ACCESS_PLAN_VERSION = "1.0.0";

export type LawfulAccessRoute =
  | "public_oa"
  | "user_supplied_pdf"
  | "licensed_tdm"
  | "manual_institutional_browser";

export type LawfulAccessOutcome =
  | "available"
  | "not_found"
  | "restricted_access"
  | "robots_or_terms_blocked"
  | "manual_handoff_required"
  | "license_declaration_required"
  | "download_failed"
  | "parse_failed";

export interface LawfulAccessPlan {
  schema: "longtable.lawful-access-plan";
  version: typeof LAWFUL_ACCESS_PLAN_VERSION;
  planId: string;
  createdAt: string;
  routes: Array<{
    route: LawfulAccessRoute;
    enabled: boolean;
    authorizationBasis: string;
    userAction?: string;
    licenseDeclarationId?: string;
  }>;
  prohibitedMethods: string[];
  typedOutcomes: LawfulAccessOutcome[];
}

export function buildLawfulAccessPlan(input: {
  runId: string;
  allowPublicOa: boolean;
  hasUserPdfDirectory: boolean;
  pdfAccessClass?: string;
}): LawfulAccessPlan {
  return {
    schema: "longtable.lawful-access-plan",
    version: LAWFUL_ACCESS_PLAN_VERSION,
    planId: `access-${input.runId}`,
    createdAt: new Date().toISOString(),
    routes: [
      {
        route: "public_oa",
        enabled: input.allowPublicOa,
        authorizationBasis: "Publicly accessible OA or repository route; credentials omitted."
      },
      {
        route: "user_supplied_pdf",
        enabled: input.hasUserPdfDirectory,
        authorizationBasis: input.pdfAccessClass
          ? `User declared access class: ${input.pdfAccessClass}.`
          : "Disabled until the user declares the lawful access class."
      },
      {
        route: "licensed_tdm",
        enabled: input.pdfAccessClass === "licensed_tdm",
        authorizationBasis: "Requires an explicit local license declaration; no credential material is recorded.",
        licenseDeclarationId: input.pdfAccessClass === "licensed_tdm" ? "user-declared-licensed-tdm" : undefined
      },
      {
        route: "manual_institutional_browser",
        enabled: true,
        authorizationBasis: "The researcher uses their own authorized browser session.",
        userAction: "Download the lawful copy manually, then supply its local directory and access class. Do not export cookies or credentials."
      }
    ],
    prohibitedMethods: [
      "paywall bypass",
      "WAF or robots bypass",
      "VPN or proxy rotation to evade controls",
      "automated institutional login",
      "cookie, token, password, or credential capture"
    ],
    typedOutcomes: [
      "available",
      "not_found",
      "restricted_access",
      "robots_or_terms_blocked",
      "manual_handoff_required",
      "license_declaration_required",
      "download_failed",
      "parse_failed"
    ]
  };
}

export function validateLawfulAccessPlan(value: unknown): LawfulAccessPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Lawful access plan must be an object.");
  }
  const plan = value as Partial<LawfulAccessPlan>;
  if (plan.schema !== "longtable.lawful-access-plan" || plan.version !== LAWFUL_ACCESS_PLAN_VERSION) {
    throw new Error(`Lawful access plan must use version ${LAWFUL_ACCESS_PLAN_VERSION}.`);
  }
  if (!Array.isArray(plan.routes) || plan.routes.length !== 4) {
    throw new Error("Lawful access plan must declare all four supported route classes.");
  }
  const serialized = JSON.stringify(plan).toLowerCase();
  for (const secretField of ["\"password\"", "\"cookie\"", "\"authorization\"", "\"token\"", "\"secret\""]) {
    if (serialized.includes(secretField)) {
      throw new Error("Lawful access plans may not store credentials, cookies, tokens, or secrets.");
    }
  }
  if (!Array.isArray(plan.prohibitedMethods) ||
      !plan.prohibitedMethods.some((item) => /paywall/i.test(item)) ||
      !plan.prohibitedMethods.some((item) => /institutional login/i.test(item))) {
    throw new Error("Lawful access plan must preserve non-bypass and non-login-automation boundaries.");
  }
  return plan as LawfulAccessPlan;
}
