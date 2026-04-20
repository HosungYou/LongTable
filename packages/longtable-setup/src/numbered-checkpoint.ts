import type {
  NumberedCheckpointSpec,
  ParsedCheckpointSelection
} from "./types.js";

export function buildNumberedCheckpointPrompt(spec: NumberedCheckpointSpec): string {
  const lines = [`CHECKPOINT: ${spec.title}`, ""];

  if (spec.instructions) {
    lines.push(spec.instructions, "");
  }

  spec.options.forEach((option, index) => {
    lines.push(`${index + 1}. ${option.label}`);
  });

  lines.push("");

  if (spec.allowRationale) {
    lines.push("Reply with one number only, or one number followed by a short rationale on the next line.");
  } else {
    lines.push(`Reply with one number only: ${spec.options.map((_, index) => index + 1).join(", ")}.`);
  }

  return lines.join("\n");
}

export function parseNumberedCheckpointResponse(
  spec: NumberedCheckpointSpec,
  input: string
): ParsedCheckpointSelection | null {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const [firstLine, ...restLines] = trimmed.split(/\r?\n/);

  if (!/^\d+$/.test(firstLine.trim())) {
    return null;
  }

  const index = Number(firstLine.trim()) - 1;
  const option = spec.options[index];

  if (!option) {
    return null;
  }

  const rationale = restLines.join("\n").trim();

  if (!spec.allowRationale && rationale.length > 0) {
    return null;
  }

  return {
    index,
    value: option.value,
    label: option.label,
    rationale: rationale.length > 0 ? rationale : undefined
  };
}
