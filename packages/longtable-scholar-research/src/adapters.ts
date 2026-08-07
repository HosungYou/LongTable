import {
  INSTITUTIONAL_RESEARCH_CAPABILITIES,
  type CapabilityResult,
  type DatabaseAdapter,
  type InstitutionalResearchCapability
} from "./workflow-types.js";

export type AdapterCapabilityInput = Readonly<Record<string, unknown>>;
export type AdapterCapabilityHandler = (
  input: AdapterCapabilityInput
) => Promise<CapabilityResult<unknown>>;

export type ExecutableDatabaseAdapter = DatabaseAdapter &
  Partial<Record<InstitutionalResearchCapability, AdapterCapabilityHandler>>;

export interface DatabaseAdapterRegistry {
  readonly get: (id: string) => ExecutableDatabaseAdapter | undefined;
  readonly list: () => readonly ExecutableDatabaseAdapter[];
}

export function validateDatabaseAdapter(adapter: ExecutableDatabaseAdapter): string[] {
  const issues: string[] = [];
  if (!adapter.id?.trim()) issues.push("Database adapter ID is required.");
  if (!adapter.version?.trim()) issues.push(`Database adapter ${adapter.id || "<unknown>"} version is required.`);
  const seen = new Set<string>();
  for (const capability of adapter.capabilities ?? []) {
    if (!INSTITUTIONAL_RESEARCH_CAPABILITIES.includes(capability)) {
      issues.push(`Database adapter ${adapter.id} declares unknown capability ${capability}.`);
      continue;
    }
    if (seen.has(capability)) issues.push(`Database adapter ${adapter.id} declares duplicate capability ${capability}.`);
    seen.add(capability);
    if (typeof adapter[capability] !== "function") {
      issues.push(`Database adapter ${adapter.id} declares ${capability} without an implementation.`);
    }
  }
  return issues;
}

export async function executeAdapterCapability(
  adapter: ExecutableDatabaseAdapter,
  capability: InstitutionalResearchCapability,
  input: AdapterCapabilityInput
): Promise<CapabilityResult<unknown>> {
  if (!adapter.capabilities.includes(capability)) {
    return {
      status: "unsupported",
      reason: `Database adapter ${adapter.id} does not declare capability ${capability}.`
    };
  }
  const handler = adapter[capability];
  if (typeof handler !== "function") {
    return {
      status: "unsupported",
      reason: `Database adapter ${adapter.id} declares ${capability} but has no implementation.`
    };
  }
  return handler(input);
}

export function createDatabaseAdapterRegistry(
  adapters: readonly ExecutableDatabaseAdapter[]
): DatabaseAdapterRegistry {
  const byId = new Map<string, ExecutableDatabaseAdapter>();
  for (const adapter of adapters) {
    const issues = validateDatabaseAdapter(adapter);
    if (issues.length > 0) {
      throw new Error(issues.join(" "));
    }
    if (byId.has(adapter.id)) {
      throw new Error(`Duplicate database adapter ID: ${adapter.id}.`);
    }
    byId.set(adapter.id, adapter);
  }
  return {
    get: (id) => byId.get(id),
    list: () => [...byId.values()].sort((left, right) => left.id.localeCompare(right.id))
  };
}
