import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  cancel,
  isCancel,
  multiselect,
  note,
  select,
  text
} from "@clack/prompts";
import type { SetupChoice } from "@longtable/setup";
import type { Interface as ReadlineInterface } from "node:readline/promises";

export interface PromptRenderer {
  text(prompt: string, options?: { required?: boolean; placeholder?: string }): Promise<string | undefined>;
  select(prompt: string, choices: SetupChoice[]): Promise<string>;
  multiselect(prompt: string, choices: SetupChoice[]): Promise<string[]>;
  note(message: string, title?: string): void;
}

function isInteractiveTerminal(): boolean {
  return Boolean(input.isTTY && output.isTTY);
}

function guardCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("LongTable cancelled.");
    throw new Error("LongTable cancelled.");
  }
  return value;
}

function renderChoices(choices: SetupChoice[]): string {
  return choices
    .map((choice, index) => `${index + 1}. ${choice.label} - ${choice.description}`)
    .join("\n");
}

let fallbackReadline: ReadlineInterface | undefined;
let fallbackInputLines: string[] | undefined;

function getFallbackReadline(): ReadlineInterface {
  fallbackReadline ??= createInterface({ input, output });
  return fallbackReadline;
}

async function askLine(prompt: string): Promise<string> {
  if (!input.isTTY) {
    output.write(prompt);
    fallbackInputLines ??= readFileSync(0, "utf8").split(/\r?\n/);
    return fallbackInputLines.shift() ?? "";
  }
  return getFallbackReadline().question(prompt);
}

async function promptChoiceByNumber(prompt: string, choices: SetupChoice[]): Promise<string> {
  while (true) {
    const answer = await askLine(`${prompt}\n${renderChoices(choices)}\nSelect one number: `);
    const numeric = Number(answer.trim());
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > choices.length) {
      console.log("Invalid selection. Enter one of the listed numbers.");
      continue;
    }

    const choice = choices[numeric - 1];
    if (choice.fallbackToText) {
      const freeText = await askLine("Type your custom value: ");
      if (!freeText.trim()) {
        console.log("Custom value cannot be empty.");
        continue;
      }
      return freeText.trim();
    }

    return choice.id;
  }
}

async function promptTextLine(
  prompt: string,
  required: boolean
): Promise<string | undefined> {
  while (true) {
    const answer = (await askLine(`${prompt}\n> `)).trim();
    if (!required) {
      return answer || undefined;
    }
    if (answer) {
      return answer;
    }
    console.log("This answer cannot be empty.");
  }
}

export function createPromptRenderer(): PromptRenderer {
  return {
    async text(prompt, options) {
      const required = options?.required ?? false;
      if (!isInteractiveTerminal()) {
        return promptTextLine(prompt, required);
      }

      return guardCancel(
        await text({
          message: prompt,
          placeholder: options?.placeholder,
          validate: required
            ? (value) => value?.trim() ? undefined : "This answer cannot be empty."
            : undefined
        })
      )?.trim() || undefined;
    },

    async select(prompt, choices) {
      if (!isInteractiveTerminal()) {
        return promptChoiceByNumber(prompt, choices);
      }

      const selected = guardCancel(
        await select({
          message: prompt,
          options: choices.map((choice) => ({
            value: choice.id,
            label: choice.label,
            hint: choice.description
          })),
          maxItems: 7
        })
      );

      const choice = choices.find((candidate) => candidate.id === selected);
      if (choice?.fallbackToText) {
        return guardCancel(
          await text({
            message: "Type your custom value",
            validate: (value) => value?.trim() ? undefined : "This answer cannot be empty."
          })
        ).trim();
      }
      return selected;
    },

    async multiselect(prompt, choices) {
      if (!isInteractiveTerminal()) {
        const answer = await askLine(`${prompt}\nType comma-separated ids or leave blank for auto.\n> `);
        return answer
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
      }

      return guardCancel(
        await multiselect({
          message: prompt,
          options: choices.map((choice) => ({
            value: choice.id,
            label: choice.label,
            hint: choice.description
          })),
          required: false,
          maxItems: 7
        })
      );
    },

    note(message, title) {
      if (isInteractiveTerminal()) {
        note(message, title);
        return;
      }
      console.log(title ? `${title}\n${message}` : message);
    }
  };
}
