import { createHash } from "node:crypto";
import { join } from "node:path";

export const LONGTABLE_MANAGED_HOOK_EVENTS = [
  "SessionStart",
  "PreToolUse",
  "PostToolUse",
  "UserPromptSubmit",
  "PreCompact",
  "PostCompact",
  "Stop"
] as const;

type ManagedHookEventName = (typeof LONGTABLE_MANAGED_HOOK_EVENTS)[number];
type JsonObject = Record<string, unknown>;
type CodexHookFeatureFlag = "hooks" | "codex_hooks";

export interface ManagedCodexHooksConfig {
  hooks: Record<ManagedHookEventName, Array<Record<string, unknown>>>;
}

interface ParsedCodexHooksConfig {
  root: JsonObject;
  hooks: JsonObject;
}

export interface RemoveManagedCodexHooksResult {
  nextContent: string | null;
  removedCount: number;
}

export interface CodexHookTrustStateEntry {
  trusted_hash: string;
}

const CODEX_HOOK_EVENT_LABELS: Record<ManagedHookEventName, string> = {
  SessionStart: "session_start",
  PreToolUse: "pre_tool_use",
  PostToolUse: "post_tool_use",
  UserPromptSubmit: "user_prompt_submit",
  PreCompact: "pre_compact",
  PostCompact: "post_compact",
  Stop: "stop"
};

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

function buildCommandHook(
  command: string,
  options: {
    matcher?: string;
    statusMessage?: string;
    timeout?: number;
  } = {}
): Record<string, unknown> {
  const hook = {
    type: "command",
    command,
    ...(options.statusMessage ? { statusMessage: options.statusMessage } : {}),
    ...(typeof options.timeout === "number" ? { timeout: options.timeout } : {})
  };

  return {
    ...(options.matcher ? { matcher: options.matcher } : {}),
    hooks: [hook]
  };
}

export function buildManagedCodexHooksConfig(packageRoot: string): ManagedCodexHooksConfig {
  const hookScript = join(packageRoot, "dist", "longtable-codex-native-hook.js");
  const command = `node "${hookScript}"`;

  return {
    hooks: {
      SessionStart: [
        buildCommandHook(command, {
          matcher: "startup|resume"
        })
      ],
      PreToolUse: [
        buildCommandHook(command, {
          matcher: "Bash",
          statusMessage: "Running LongTable checkpoint guard"
        })
      ],
      PostToolUse: [
        buildCommandHook(command, {
          matcher: "Bash",
          statusMessage: "Reviewing LongTable post-tool state"
        })
      ],
      UserPromptSubmit: [
        buildCommandHook(command, {
          statusMessage: "Applying LongTable research context"
        })
      ],
      PreCompact: [
        buildCommandHook(command)
      ],
      PostCompact: [
        buildCommandHook(command)
      ],
      Stop: [
        buildCommandHook(command, {
          timeout: 30
        })
      ]
    }
  };
}

export function parseCodexHooksConfig(content: string): ParsedCodexHooksConfig | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!isPlainObject(parsed)) {
      return null;
    }
    return {
      root: cloneJson(parsed),
      hooks: isPlainObject(parsed.hooks) ? cloneJson(parsed.hooks) : {}
    };
  } catch {
    return null;
  }
}

function isLongTableManagedHookCommand(command: string): boolean {
  return /(?:^|[\\/])longtable-codex-native-hook\.js(?:["'\s]|$)/.test(command);
}

function countManagedHooksInEntry(entry: unknown): number {
  if (!isPlainObject(entry) || !Array.isArray(entry.hooks)) {
    return 0;
  }

  return entry.hooks.filter((hook) =>
    isPlainObject(hook) &&
    hook.type === "command" &&
    typeof hook.command === "string" &&
    isLongTableManagedHookCommand(hook.command)
  ).length;
}

export function getMissingManagedCodexHookEvents(content: string): ManagedHookEventName[] | null {
  const parsed = parseCodexHooksConfig(content);
  if (!parsed) {
    return null;
  }

  return LONGTABLE_MANAGED_HOOK_EVENTS.filter((eventName) => {
    const entries = Array.isArray(parsed.hooks[eventName]) ? parsed.hooks[eventName] : [];
    return !entries.some((entry) => countManagedHooksInEntry(entry) > 0);
  });
}

function stripManagedHooksFromEntry(entry: unknown): {
  entry: unknown | null;
  removedCount: number;
} {
  if (!isPlainObject(entry) || !Array.isArray(entry.hooks)) {
    return { entry: cloneJson(entry), removedCount: 0 };
  }

  const nextHooks = entry.hooks.filter((hook) => {
    if (!isPlainObject(hook)) {
      return true;
    }
    return !(
      hook.type === "command" &&
      typeof hook.command === "string" &&
      isLongTableManagedHookCommand(hook.command)
    );
  });

  const removedCount = entry.hooks.length - nextHooks.length;
  if (removedCount === 0) {
    return { entry: cloneJson(entry), removedCount: 0 };
  }
  if (nextHooks.length === 0) {
    return { entry: null, removedCount };
  }

  return {
    entry: {
      ...cloneJson(entry),
      hooks: nextHooks
    },
    removedCount
  };
}

function serializeCodexHooksConfig(root: JsonObject): string {
  return JSON.stringify(root, null, 2) + "\n";
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalJson(item));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])])
    );
  }
  return value;
}

function versionForCodexTomlIdentity(value: unknown): string {
  const serialized = JSON.stringify(canonicalJson(value));
  return `sha256:${createHash("sha256").update(serialized).digest("hex")}`;
}

function normalizedCommandHookIdentity(
  eventName: ManagedHookEventName,
  entry: JsonObject,
  hook: JsonObject
): JsonObject {
  return {
    event_name: CODEX_HOOK_EVENT_LABELS[eventName],
    ...(typeof entry.matcher === "string" ? { matcher: entry.matcher } : {}),
    hooks: [
      {
        type: "command",
        command: hook.command,
        timeout: Math.max(1, typeof hook.timeout === "number" ? hook.timeout : 600),
        async: false,
        ...(typeof hook.statusMessage === "string" ? { statusMessage: hook.statusMessage } : {})
      }
    ]
  };
}

function managedHookStateKey(
  hooksPath: string,
  eventName: ManagedHookEventName,
  groupIndex: number,
  handlerIndex: number
): string {
  return `${hooksPath}:${CODEX_HOOK_EVENT_LABELS[eventName]}:${groupIndex}:${handlerIndex}`;
}

export function buildManagedCodexHookTrustState(
  hooksPath: string,
  hooksContent: string
): Record<string, CodexHookTrustStateEntry> {
  const parsed = parseCodexHooksConfig(hooksContent);
  if (!parsed) {
    return {};
  }

  const state: Record<string, CodexHookTrustStateEntry> = {};
  for (const eventName of LONGTABLE_MANAGED_HOOK_EVENTS) {
    const entries = Array.isArray(parsed.hooks[eventName]) ? parsed.hooks[eventName] : [];
    entries.forEach((entry, groupIndex) => {
      if (!isPlainObject(entry) || !Array.isArray(entry.hooks)) {
        return;
      }
      entry.hooks.forEach((hook, handlerIndex) => {
        if (
          !isPlainObject(hook) ||
          hook.type !== "command" ||
          typeof hook.command !== "string" ||
          !isLongTableManagedHookCommand(hook.command)
        ) {
          return;
        }
        state[managedHookStateKey(hooksPath, eventName, groupIndex, handlerIndex)] = {
          trusted_hash: versionForCodexTomlIdentity(normalizedCommandHookIdentity(eventName, entry, hook))
        };
      });
    });
  }
  return state;
}

function escapeTomlBasicString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function unescapeTomlBasicString(value: string): string {
  return value.replace(/\\(["\\])/g, "$1");
}

function readHooksStateTableKey(line: string): string | null {
  const match = line.trim().match(/^\[hooks\.state\."((?:\\.|[^"\\])*)"\]$/);
  return match ? unescapeTomlBasicString(match[1]) : null;
}

function removeHookStateTables(
  config: string,
  shouldRemove: (key: string) => boolean
): string {
  const lines = config.split(/\r?\n/);
  const kept: string[] = [];
  for (let index = 0; index < lines.length;) {
    const key = readHooksStateTableKey(lines[index]);
    if (!key || !shouldRemove(key)) {
      kept.push(lines[index]);
      index += 1;
      continue;
    }

    index += 1;
    while (index < lines.length && !/^\s*\[/.test(lines[index])) {
      index += 1;
    }
  }

  return `${kept.join("\n").trimEnd()}\n`;
}

function readHookStateTrustedHashes(config: string): Map<string, string> {
  const lines = config.split(/\r?\n/);
  const hashes = new Map<string, string>();
  for (let index = 0; index < lines.length;) {
    const key = readHooksStateTableKey(lines[index]);
    if (!key) {
      index += 1;
      continue;
    }

    index += 1;
    while (index < lines.length && !/^\s*\[/.test(lines[index])) {
      const match = lines[index].trim().match(/^trusted_hash\s*=\s*"([^"]+)"$/);
      if (match) {
        hashes.set(key, match[1]);
      }
      index += 1;
    }
  }
  return hashes;
}

function renderCodexHookTrustToml(state: Record<string, CodexHookTrustStateEntry>): string {
  return Object.entries(state)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([key, entry]) => [
      `[hooks.state."${escapeTomlBasicString(key)}"]`,
      `trusted_hash = "${escapeTomlBasicString(entry.trusted_hash)}"`,
      ""
    ])
    .join("\n")
    .trimEnd();
}

export function mergeCodexHookTrustState(
  config: string,
  hooksPath: string,
  hooksContent: string
): string {
  const state = buildManagedCodexHookTrustState(hooksPath, hooksContent);
  const keys = new Set(Object.keys(state));
  if (keys.size === 0) {
    return config.trimEnd() ? `${config.trimEnd()}\n` : "";
  }

  const withoutCurrent = removeHookStateTables(config, (key) => keys.has(key)).trimEnd();
  const trustToml = renderCodexHookTrustToml(state);
  return withoutCurrent ? `${withoutCurrent}\n\n${trustToml}\n` : `${trustToml}\n`;
}

export function removeCodexHookTrustState(
  config: string,
  hooksPath: string,
  hooksContent: string
): string {
  const keys = new Set(Object.keys(buildManagedCodexHookTrustState(hooksPath, hooksContent)));
  if (keys.size === 0) {
    return config.trimEnd() ? `${config.trimEnd()}\n` : "";
  }
  return removeHookStateTables(config, (key) => keys.has(key));
}

export function getMissingManagedCodexHookTrustState(
  config: string,
  hooksPath: string,
  hooksContent: string
): string[] {
  const expected = buildManagedCodexHookTrustState(hooksPath, hooksContent);
  const hashes = readHookStateTrustedHashes(config);
  const missing: string[] = [];
  for (const [key, entry] of Object.entries(expected)) {
    if (hashes.get(key) !== entry.trusted_hash) {
      missing.push(key);
    }
  }
  return missing;
}

export function mergeManagedCodexHooksConfig(
  existingContent: string | null | undefined,
  packageRoot: string
): string {
  const managedConfig = buildManagedCodexHooksConfig(packageRoot);
  const parsed = typeof existingContent === "string"
    ? parseCodexHooksConfig(existingContent)
    : null;

  const nextRoot = parsed ? cloneJson(parsed.root) : {};
  const nextHooks = parsed ? cloneJson(parsed.hooks) : {};

  for (const eventName of LONGTABLE_MANAGED_HOOK_EVENTS) {
    const existingEntries = Array.isArray(nextHooks[eventName]) ? nextHooks[eventName] : [];
    const preservedEntries: unknown[] = [];

    for (const entry of existingEntries) {
      const stripped = stripManagedHooksFromEntry(entry);
      if (stripped.entry !== null) {
        preservedEntries.push(stripped.entry);
      }
    }

    nextHooks[eventName] = [
      ...preservedEntries,
      ...managedConfig.hooks[eventName].map((entry) => cloneJson(entry))
    ];
  }

  nextRoot.hooks = nextHooks;
  return serializeCodexHooksConfig(nextRoot);
}

export function removeManagedCodexHooks(existingContent: string): RemoveManagedCodexHooksResult {
  const parsed = parseCodexHooksConfig(existingContent);
  if (!parsed) {
    return { nextContent: existingContent, removedCount: 0 };
  }

  const nextRoot = cloneJson(parsed.root);
  const nextHooks = cloneJson(parsed.hooks);
  let removedCount = 0;

  for (const [eventName, rawEntries] of Object.entries(nextHooks)) {
    if (!Array.isArray(rawEntries)) {
      continue;
    }

    const preservedEntries: unknown[] = [];
    for (const entry of rawEntries) {
      const stripped = stripManagedHooksFromEntry(entry);
      removedCount += stripped.removedCount;
      if (stripped.entry !== null) {
        preservedEntries.push(stripped.entry);
      }
    }

    if (preservedEntries.length > 0) {
      nextHooks[eventName] = preservedEntries;
    } else {
      delete nextHooks[eventName];
    }
  }

  if (removedCount === 0) {
    return { nextContent: existingContent, removedCount: 0 };
  }

  if (Object.keys(nextHooks).length > 0) {
    nextRoot.hooks = nextHooks;
    return { nextContent: serializeCodexHooksConfig(nextRoot), removedCount };
  }

  delete nextRoot.hooks;
  if (Object.keys(nextRoot).length > 0) {
    return { nextContent: serializeCodexHooksConfig(nextRoot), removedCount };
  }

  return { nextContent: null, removedCount };
}

function findSectionBounds(lines: string[], sectionHeader: string): { start: number; end: number } | null {
  const start = lines.findIndex((line) => line.trim() === sectionHeader);
  if (start === -1) {
    return null;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return { start, end };
}

function normalizeCodexHookFeatureFlag(value?: string): CodexHookFeatureFlag {
  return value === "codex_hooks" ? "codex_hooks" : "hooks";
}

export function enableCodexHooksFeature(existing: string, featureFlag?: string): string {
  const flagName = normalizeCodexHookFeatureFlag(featureFlag);
  const trimmed = existing.trimEnd();
  const lines = trimmed ? trimmed.split(/\r?\n/) : [];
  const section = findSectionBounds(lines, "[features]");

  if (!section) {
    return trimmed
      ? `${trimmed}\n\n[features]\n${flagName} = true\n`
      : `[features]\n${flagName} = true\n`;
  }

  const featureLines = lines.slice(section.start + 1, section.end);
  const existingIndex = featureLines.findIndex((line) => new RegExp(`^\\s*${flagName}\\s*=`).test(line));
  if (existingIndex !== -1) {
    featureLines[existingIndex] = `${flagName} = true`;
  } else {
    featureLines.push(`${flagName} = true`);
  }

  const rebuilt = [
    ...lines.slice(0, section.start + 1),
    ...featureLines,
    ...lines.slice(section.end)
  ].join("\n");
  return `${rebuilt.trimEnd()}\n`;
}

export function codexHooksEnabled(config: string): boolean {
  const lines = config.split(/\r?\n/);
  const section = findSectionBounds(lines, "[features]");
  if (!section) {
    return false;
  }

  return lines
    .slice(section.start + 1, section.end)
    .some((line) => /^\s*(?:hooks|codex_hooks)\s*=\s*true\s*$/.test(line));
}
