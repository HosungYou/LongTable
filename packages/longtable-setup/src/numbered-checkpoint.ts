import type {
  NumberedCheckpointSpec,
  ParsedCheckpointSelection
} from "./types.js";

export function buildNumberedCheckpointPrompt(spec: NumberedCheckpointSpec): string {
  const lines = [`CHECKPOINT: ${spec.title}`, ""];

  if (spec.instructions) {
    lines.push(spec.instructions, "");
  }

  if (spec.selectionMode !== "free_text") {
    spec.options.forEach((option, index) => {
      lines.push(`${index + 1}. ${option.label}`);
    });

    lines.push("");
  }

  if (spec.selectionMode === "free_text") {
    lines.push("Reply with a concise free-text answer.");
  } else if (spec.selectionMode === "multi") {
    if (spec.allowRationale) {
      lines.push("Reply with one or more numbers separated by commas, or the numbers followed by a short rationale on the next line.");
    } else {
      lines.push(`Reply with one or more numbers separated by commas: ${spec.options.map((_, index) => index + 1).join(", ")}.`);
    }
  } else if (spec.allowRationale) {
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
  const rationale = restLines.join("\n").trim();

  if (spec.selectionMode === "free_text") {
    return {
      index: -1,
      value: trimmed,
      label: trimmed,
      values: [trimmed],
      labels: [trimmed],
      rationale: undefined
    };
  }

  if (spec.selectionMode === "multi") {
    const tokens = firstLine.split(/[;,]/).map((token) => token.trim()).filter(Boolean);
    if (tokens.length === 0 || !tokens.every((token) => /^\d+$/.test(token))) {
      return null;
    }

    const indices = [...new Set(tokens.map((token) => Number(token) - 1))];
    const selected = indices.map((index) => ({ index, option: spec.options[index] }));
    if (selected.some((entry) => !entry.option)) {
      return null;
    }

    if (!spec.allowRationale && rationale.length > 0) {
      return null;
    }

    const first = selected[0];
    if (!first?.option) {
      return null;
    }

    return {
      index: first.index,
      value: first.option.value,
      label: first.option.label,
      indices,
      values: selected.map((entry) => entry.option.value),
      labels: selected.map((entry) => entry.option.label),
      rationale: rationale.length > 0 ? rationale : undefined
    };
  }

  if (!/^\d+$/.test(firstLine.trim())) {
    return null;
  }

  const index = Number(firstLine.trim()) - 1;
  const option = spec.options[index];

  if (!option) {
    return null;
  }

  if (!spec.allowRationale && rationale.length > 0) {
    return null;
  }

  return {
    index,
    value: option.value,
    label: option.label,
    indices: [index],
    values: [option.value],
    labels: [option.label],
    rationale: rationale.length > 0 ? rationale : undefined
  };
}
