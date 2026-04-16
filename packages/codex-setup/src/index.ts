#!/usr/bin/env node
/**
 * Diverga Setup for Codex CLI
 * Interactive TUI installer using @clack/prompts
 *
 * Usage:
 *   npx @diverga/codex-setup
 *   bunx diverga-setup
 */

import * as clack from '@clack/prompts';
import pc from 'picocolors';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import yaml from 'js-yaml';

// Version
const VERSION = '8.1.0';

// ASCII Banner (ASCII-only for maximum compatibility)
const BANNER = `
    ____  _
   / __ \\(_)   _____  _________ _____ _
  / / / / / | / / _ \\/ ___/ __ \`/ __ \`/
 / /_/ / /| |/ /  __/ /  / /_/ / /_/ /
/_____/_/ |___/\\___/_/   \\__, /\\__,_/
                        /____/

    Diverge from the Modal - Discover the Exceptional
    --------------------------------------------------
`;

// Agent categories for display
const AGENT_CATEGORIES = {
  'A - Research Foundation': ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
  'B - Literature & Evidence': ['B1', 'B2', 'B3', 'B4', 'B5'],
  'C - Study Design & Meta-Analysis': ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'],
  'D - Data Collection': ['D1', 'D2', 'D3', 'D4'],
  'E - Analysis': ['E1', 'E2', 'E3', 'E4', 'E5'],
  'F - Quality & Validation': ['F1', 'F2', 'F3', 'F4', 'F5'],
  'G - Publication': ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'],
  'H - Specialized': ['H1', 'H2'],
};

// Paths
const CODEX_DIR = path.join(os.homedir(), '.codex');
const DIVERGA_DIR = path.join(CODEX_DIR, 'diverga');
const SKILLS_DIR = path.join(DIVERGA_DIR, 'skills');
const CONFIG_PATH = path.join(DIVERGA_DIR, 'config.yaml');
const MANAGED_ROOT = path.join(os.homedir(), '.diverga');
const MANAGED_SETUP_PATH = path.join(MANAGED_ROOT, 'setup.json');
const MANAGED_CODEX_RUNTIME_PATH = path.join(
  MANAGED_ROOT,
  'runtime',
  'codex',
  'diverga.toml'
);

interface DivergaConfig {
  version: string;
  paradigm: 'quantitative' | 'qualitative' | 'mixed' | 'auto';
  language: 'en' | 'ko' | 'auto';
  creativity_level: 'conservative' | 'balanced' | 'innovative';
  default_model: 'o1' | 'gpt-4' | 'gpt-3.5-turbo';
  checkpoints: {
    required: boolean;
    recommended: boolean;
    optional: boolean;
  };
  runtime_bridge?: {
    enabled: boolean;
    source: 'diverga-managed-runtime';
    setup_path: string;
    runtime_config_path: string;
    profile_summary: {
      field: string;
      career_stage: string;
      experience_level: string;
      current_project_type: string;
    };
    runtime_guidance?: {
      ask_at_least_two_questions_in_explore: boolean;
      preserve_narrative_trace_in_draft: boolean;
      require_why_may_be_wrong_in_review: boolean;
      question_bias_compensation?: string;
    };
    imported_at: string;
  };
  installed_at: string;
}

interface ManagedProfileSeed {
  field: string;
  careerStage: string;
  experienceLevel: 'novice' | 'intermediate' | 'advanced';
  currentProjectType: string;
  preferredCheckpointIntensity: 'low' | 'balanced' | 'high';
  humanAuthorshipSignal?: string;
}

interface ManagedRuntimeGuidance {
  askAtLeastTwoQuestionsInExplore: boolean;
  preserveNarrativeTraceInDraft: boolean;
  requireWhyMayBeWrongInReview: boolean;
  questionBiasCompensation?: string;
}

interface ManagedSetupOutput {
  profileSeed: ManagedProfileSeed;
  providerSelection: {
    provider: 'codex' | 'claude';
    checkpointProtocol: string;
    supportsStructuredQuestions: boolean;
  };
  defaultInteractionMode?: string;
}

interface ManagedCodexBridge {
  setupPath: string;
  runtimeConfigPath: string;
  profileSeed: ManagedProfileSeed;
  checkpointInitialValues: string[];
  runtimeGuidance?: ManagedRuntimeGuidance;
}

function checkpointDefaultsForIntensity(
  intensity: ManagedProfileSeed['preferredCheckpointIntensity']
): string[] {
  if (intensity === 'low') {
    return ['required'];
  }

  if (intensity === 'high') {
    return ['required', 'recommended', 'optional'];
  }

  return ['required', 'recommended'];
}

function parseTomlBoolean(content: string, key: string): boolean | undefined {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*(true|false)$`, 'm'));
  return match ? match[1] === 'true' : undefined;
}

function parseTomlString(content: string, key: string): string | undefined {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"$`, 'm'));
  return match ? match[1] : undefined;
}

function readManagedCodexRuntimeGuidance(runtimePath: string): ManagedRuntimeGuidance | undefined {
  if (!fs.existsSync(runtimePath)) {
    return undefined;
  }

  try {
    const raw = fs.readFileSync(runtimePath, 'utf8');
    return {
      askAtLeastTwoQuestionsInExplore:
        parseTomlBoolean(raw, 'ask_at_least_two_questions_in_explore') ?? true,
      preserveNarrativeTraceInDraft:
        parseTomlBoolean(raw, 'preserve_narrative_trace_in_draft') ?? true,
      requireWhyMayBeWrongInReview:
        parseTomlBoolean(raw, 'require_why_may_be_wrong_in_review') ?? true,
      questionBiasCompensation: parseTomlString(raw, 'question_bias_compensation'),
    };
  } catch {
    return undefined;
  }
}

function detectManagedCodexBridge(): ManagedCodexBridge | null {
  if (!fs.existsSync(MANAGED_SETUP_PATH)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(MANAGED_SETUP_PATH, 'utf8');
    const parsed = JSON.parse(raw) as ManagedSetupOutput;

    if (parsed.providerSelection?.provider !== 'codex' || !parsed.profileSeed) {
      return null;
    }

    return {
      setupPath: MANAGED_SETUP_PATH,
      runtimeConfigPath: MANAGED_CODEX_RUNTIME_PATH,
      profileSeed: parsed.profileSeed,
      checkpointInitialValues: checkpointDefaultsForIntensity(
        parsed.profileSeed.preferredCheckpointIntensity
      ),
      runtimeGuidance: readManagedCodexRuntimeGuidance(MANAGED_CODEX_RUNTIME_PATH),
    };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  console.clear();
  console.log(pc.cyan(BANNER));

  clack.intro(pc.bgCyan(pc.black(` Diverga Setup for Codex CLI v${VERSION} `)));

  // Check if already installed
  const isInstalled = fs.existsSync(DIVERGA_DIR);
  if (isInstalled) {
    const reinstall = await clack.confirm({
      message: 'Diverga is already installed. Would you like to reconfigure?',
      initialValue: false,
    });

    if (clack.isCancel(reinstall) || !reinstall) {
      clack.outro('Setup cancelled. Your existing configuration is preserved.');
      process.exit(0);
    }
  }

  const managedBridge = detectManagedCodexBridge();
  let useManagedBridge = false;

  if (managedBridge) {
    const shouldImportManaged = await clack.confirm({
      message:
        'Found Diverga-managed setup artifacts. Import researcher profile and checkpoint defaults into this Codex setup?',
      initialValue: true,
    });

    if (clack.isCancel(shouldImportManaged)) {
      clack.cancel('Setup cancelled.');
      process.exit(0);
    }

    if (shouldImportManaged) {
      useManagedBridge = true;
      clack.note(
        [
          `${pc.cyan('Field:')}         ${managedBridge.profileSeed.field}`,
          `${pc.cyan('Career stage:')}  ${managedBridge.profileSeed.careerStage}`,
          `${pc.cyan('Experience:')}    ${managedBridge.profileSeed.experienceLevel}`,
          `${pc.cyan('Project type:')}  ${managedBridge.profileSeed.currentProjectType}`,
          `${pc.cyan('Authorship signal:')} ${
            managedBridge.profileSeed.humanAuthorshipSignal ?? 'not provided'
          }`,
          `${pc.cyan('Setup path:')}    ${managedBridge.setupPath}`,
          `${pc.cyan('Runtime path:')}  ${managedBridge.runtimeConfigPath}`,
          `${pc.cyan('Question bias:')}  ${
            managedBridge.runtimeGuidance?.questionBiasCompensation ?? 'default'
          }`,
        ].join('\n'),
        'Imported Diverga-managed profile'
      );
    }
  }

  // Step 1: Research Paradigm Selection
  const paradigm = await clack.select({
    message: 'What is your primary research paradigm?',
    options: [
      {
        value: 'auto',
        label: 'Auto-detect (Recommended)',
        hint: 'Diverga will detect your paradigm from context',
      },
      {
        value: 'quantitative',
        label: 'Quantitative Research',
        hint: 'Experimental, survey, meta-analysis',
      },
      {
        value: 'qualitative',
        label: 'Qualitative Research',
        hint: 'Phenomenology, grounded theory, case study',
      },
      {
        value: 'mixed',
        label: 'Mixed Methods',
        hint: 'Sequential, convergent, embedded designs',
      },
    ],
  });

  if (clack.isCancel(paradigm)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }

  // Step 2: Language Preference
  const language = await clack.select({
    message: 'Preferred language for responses?',
    options: [
      { value: 'auto', label: 'Auto-detect (Recommended)', hint: 'Based on your input' },
      { value: 'en', label: 'English' },
      { value: 'ko', label: 'Korean (한국어)' },
    ],
  });

  if (clack.isCancel(language)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }

  // Step 3: Creativity Level (T-Score preference)
  const creativity = await clack.select({
    message: 'Default creativity level for recommendations?',
    options: [
      {
        value: 'conservative',
        label: 'Conservative (T >= 0.5)',
        hint: 'Safe, validated approaches',
      },
      {
        value: 'balanced',
        label: 'Balanced (T >= 0.3) - Recommended',
        hint: 'Differentiated + defensible',
      },
      {
        value: 'innovative',
        label: 'Innovative (T >= 0.2)',
        hint: 'High contribution potential',
      },
    ],
    initialValue: 'balanced',
  });

  if (clack.isCancel(creativity)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }

  // Step 4: Default Model Tier
  const model = await clack.select({
    message: 'Default model for general tasks?',
    options: [
      { value: 'gpt-4', label: 'GPT-4 (Recommended)', hint: 'Best balance of quality and speed' },
      { value: 'o1', label: 'O1 (Reasoning)', hint: 'For complex reasoning tasks' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', hint: 'Faster, lower cost' },
    ],
    initialValue: 'gpt-4',
  });

  if (clack.isCancel(model)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }

  // Step 5: Checkpoint Preferences
  const checkpoints = await clack.multiselect({
    message: 'Which checkpoint levels should halt for approval?',
    options: [
      {
        value: 'required',
        label: 'Required (MANDATORY)',
        hint: 'Research direction, paradigm, theory selection',
      },
      {
        value: 'recommended',
        label: 'Recommended',
        hint: 'Analysis plan, integration strategy',
      },
      {
        value: 'optional',
        label: 'Optional',
        hint: 'Visualization, search strategy, writing style',
      },
    ],
    initialValues: managedBridge && useManagedBridge
      ? managedBridge.checkpointInitialValues
      : ['required', 'recommended'],
    required: true,
  });

  if (clack.isCancel(checkpoints)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }

  // Create configuration
  const config: DivergaConfig = {
    version: VERSION,
    paradigm: paradigm as DivergaConfig['paradigm'],
    language: language as DivergaConfig['language'],
    creativity_level: creativity as DivergaConfig['creativity_level'],
    default_model: model as DivergaConfig['default_model'],
    checkpoints: {
      required: (checkpoints as string[]).includes('required'),
      recommended: (checkpoints as string[]).includes('recommended'),
      optional: (checkpoints as string[]).includes('optional'),
    },
    runtime_bridge: managedBridge && useManagedBridge
      ? {
          enabled: true,
          source: 'diverga-managed-runtime',
          setup_path: managedBridge.setupPath,
          runtime_config_path: managedBridge.runtimeConfigPath,
          profile_summary: {
            field: managedBridge.profileSeed.field,
            career_stage: managedBridge.profileSeed.careerStage,
            experience_level: managedBridge.profileSeed.experienceLevel,
            current_project_type: managedBridge.profileSeed.currentProjectType,
          },
          runtime_guidance: managedBridge.runtimeGuidance
            ? {
                ask_at_least_two_questions_in_explore:
                  managedBridge.runtimeGuidance.askAtLeastTwoQuestionsInExplore,
                preserve_narrative_trace_in_draft:
                  managedBridge.runtimeGuidance.preserveNarrativeTraceInDraft,
                require_why_may_be_wrong_in_review:
                  managedBridge.runtimeGuidance.requireWhyMayBeWrongInReview,
                question_bias_compensation:
                  managedBridge.runtimeGuidance.questionBiasCompensation,
              }
            : undefined,
          imported_at: new Date().toISOString(),
        }
      : undefined,
    installed_at: new Date().toISOString(),
  };

  // Installation spinner
  const s = clack.spinner();
  s.start('Installing Diverga for Codex CLI...');

  try {
    // Create directories
    if (!fs.existsSync(CODEX_DIR)) {
      fs.mkdirSync(CODEX_DIR, { recursive: true });
    }
    if (!fs.existsSync(DIVERGA_DIR)) {
      fs.mkdirSync(DIVERGA_DIR, { recursive: true });
    }
    if (!fs.existsSync(SKILLS_DIR)) {
      fs.mkdirSync(SKILLS_DIR, { recursive: true });
    }

    // Write configuration
    const yamlContent = yaml.dump(config, { indent: 2 });
    fs.writeFileSync(CONFIG_PATH, yamlContent);

    // Copy SKILL.md and AGENTS.md
    const scriptDir = path.dirname(new URL(import.meta.url).pathname);
    const sourceDir = path.resolve(scriptDir, '..', '..', 'skills', 'diverga');

    // Create SKILL.md if it doesn't exist in source
    const skillContent = generateSkillMd(config);
    fs.writeFileSync(path.join(DIVERGA_DIR, 'SKILL.md'), skillContent);

    // Create AGENTS.md
    const agentsContent = generateAgentsMd();
    fs.writeFileSync(path.join(DIVERGA_DIR, 'AGENTS.md'), agentsContent);

    s.stop('Installation complete!');

    // Show summary
    console.log('');
    clack.note(
      [
        `${pc.cyan('Paradigm:')}      ${paradigm}`,
        `${pc.cyan('Language:')}      ${language}`,
        `${pc.cyan('Creativity:')}    ${creativity}`,
        `${pc.cyan('Model:')}         ${model}`,
        `${pc.cyan('Checkpoints:')}   ${(checkpoints as string[]).join(', ')}`,
        `${pc.cyan('Managed bridge:')} ${config.runtime_bridge ? 'enabled' : 'disabled'}`,
        '',
        `${pc.dim('Config saved to:')} ${CONFIG_PATH}`,
      ].join('\n'),
      'Configuration Summary'
    );

    if (config.runtime_bridge) {
      console.log('');
      clack.note(
        [
          `${pc.cyan('Managed setup:')}   ${config.runtime_bridge.setup_path}`,
          `${pc.cyan('Managed runtime:')} ${config.runtime_bridge.runtime_config_path}`,
          `${pc.cyan('Imported field:')}  ${config.runtime_bridge.profile_summary.field}`,
          `${pc.cyan('Project type:')}    ${config.runtime_bridge.profile_summary.current_project_type}`,
          `${pc.cyan('Question bias:')}   ${
            config.runtime_bridge.runtime_guidance?.question_bias_compensation ?? 'default'
          }`,
          `${pc.cyan('Narrative trace:')} ${
            config.runtime_bridge.runtime_guidance?.preserve_narrative_trace_in_draft
              ? 'preserve in draft'
              : 'not specified'
          }`,
        ].join('\n'),
        'Diverga-managed runtime bridge'
      );
    }

    // Show agent count
    const totalAgents = Object.values(AGENT_CATEGORIES).flat().length;
    console.log('');
    clack.note(
      [
        `${pc.green('40')} specialized research agents installed across 8 categories:`,
        '',
        ...Object.entries(AGENT_CATEGORIES).map(
          ([cat, agents]) => `  ${pc.cyan(cat)}: ${agents.join(', ')}`
        ),
      ].join('\n'),
      'Agent Catalog'
    );

    // Show usage instructions
    clack.outro(
      pc.green('Setup complete! ') +
        pc.dim('Use keywords like "research question", "meta-analysis", or "theoretical framework" to trigger agents.')
    );

    console.log('');
    console.log(pc.dim('Quick commands:'));
    console.log(
      `  ${pc.cyan('$')} diverga-codex list       ${pc.dim('# List all 40 agents')}`
    );
    console.log(
      `  ${pc.cyan('$')} diverga-codex tscore     ${pc.dim('# T-Score reference')}`
    );
    console.log(
      `  ${pc.cyan('$')} diverga-codex vs         ${pc.dim('# VS methodology explained')}`
    );
    console.log('');
    console.log(pc.dim('Documentation: https://github.com/HosungYou/Diverga'));
    console.log('');
  } catch (error) {
    s.stop('Installation failed');
    clack.log.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function generateSkillMd(config: DivergaConfig): string {
  return `---
name: Diverga Research Coordinator
description: Multi-agent system for social science research with VS methodology
version: ${VERSION}
triggers:
  - research question
  - theoretical framework
  - meta-analysis
  - systematic review
  - phenomenology
  - grounded theory
  - mixed methods
  - effect size
  - IRB
  - PRISMA
---

# Diverga Research Coordinator v${VERSION}

You are enhanced with **Diverga Research Coordinator** - a multi-agent system for social science research with 40 specialized agents across 8 categories.

## Configuration

- **Paradigm**: ${config.paradigm}
- **Language**: ${config.language}
- **Creativity Level**: ${config.creativity_level}
- **Default Model**: ${config.default_model}
- **Checkpoints**: Required=${config.checkpoints.required}, Recommended=${config.checkpoints.recommended}, Optional=${config.checkpoints.optional}

## Core Principle

> "Human decisions remain with humans. AI handles what's beyond human scope."
> "인간이 할 일은 인간이, AI는 인간의 범주를 벗어난 것을 수행"

## VS Methodology (Verbalized Sampling)

VS prevents AI "mode collapse" - the tendency to always recommend the most common approaches.

### T-Score Reference

| T-Score | Label | Meaning |
|---------|-------|---------|
| >= 0.7 | Common | Highly typical, limited novelty |
| 0.5-0.7 | Established | Standard approach |
| 0.4-0.5 | Moderate | Balanced risk-novelty |
| 0.3-0.4 | Emerging | Novel, needs justification |
| 0.2-0.3 | Innovative | High contribution potential |
| < 0.2 | Experimental | Paradigm-challenging |

## Human Checkpoint System

At checkpoints, you MUST stop and wait for explicit user approval.

### Required Checkpoints (MANDATORY)

- CP_RESEARCH_DIRECTION: Research question finalized
- CP_PARADIGM_SELECTION: Methodology approach
- CP_THEORY_SELECTION: Framework chosen
- CP_METHODOLOGY_APPROVAL: Design complete

## Agent Categories

See AGENTS.md for the complete catalog of 40 specialized agents.
`;
}

function generateAgentsMd(): string {
  return `# Diverga Agent Catalog

**Version**: ${VERSION}
**Total Agents**: 40

## Agent Registry

### Category A: Research Foundation (6 agents)

| ID | Name | Model | Purpose |
|----|------|-------|---------|
| A1 | Research Question Refiner | gpt-4 | PICO/SPIDER frameworks, scope optimization |
| A2 | Theoretical Framework Architect | o1 | Theory selection, conceptual models |
| A3 | Devil's Advocate | gpt-4 | Weakness identification, reviewer simulation |
| A4 | Research Ethics Advisor | gpt-4 | IRB protocols, consent forms |
| A5 | Paradigm & Worldview Advisor | o1 | Epistemology, ontology guidance |
| A6 | Conceptual Framework Visualizer | o1 | Framework diagrams, visual models |

### Category B: Literature & Evidence (5 agents)

| ID | Name | Model | Purpose |
|----|------|-------|---------|
| B1 | Literature Review Strategist | gpt-4 | PRISMA-compliant search, scoping review |
| B2 | Evidence Quality Appraiser | gpt-4 | RoB, CASP, JBI, GRADE |
| B3 | Effect Size Extractor | gpt-3.5 | Calculate, convert effect sizes |
| B4 | Research Radar | gpt-3.5 | Track recent publications |
| B5 | Parallel Document Processor | gpt-4 | Batch PDF processing |

### Category C: Study Design & Meta-Analysis (7 agents)

| ID | Name | Model | Purpose |
|----|------|-------|---------|
| C1 | Quantitative Design Consultant | o1 | Experimental, quasi-experimental |
| C2 | Qualitative Design Consultant | o1 | Phenomenology, grounded theory |
| C3 | Mixed Methods Design Consultant | o1 | Convergent, sequential designs |
| C4 | Experimental Materials Developer | gpt-4 | Stimuli, instruments, protocols |
| C5 | Meta-Analysis Master | o1 | Multi-gate validation, orchestration |
| C6 | Data Integrity Guard | gpt-4 | Data completeness, Hedges' g calculation |
| C7 | Error Prevention Engine | gpt-4 | Pattern detection, anomaly alerts |

### Category D: Data Collection (4 agents)

| ID | Name | Model | Purpose |
|----|------|-------|---------|
| D1 | Sampling Strategy Advisor | gpt-4 | Probability, purposeful sampling |
| D2 | Interview & Focus Group Specialist | gpt-4 | Protocol development |
| D3 | Observation Protocol Designer | gpt-3.5 | Structured observation guides |
| D4 | Measurement Instrument Developer | o1 | Scale development, validation |

### Category E: Analysis (5 agents)

| ID | Name | Model | Purpose |
|----|------|-------|---------|
| E1 | Quantitative Analysis Guide | o1 | Statistical method selection |
| E2 | Qualitative Coding Specialist | gpt-4 | Thematic analysis, coding |
| E3 | Mixed Methods Integration | o1 | Joint displays, meta-inference |
| E4 | Analysis Code Generator | gpt-3.5 | R, Python, SPSS code |
| E5 | Sensitivity Analysis Designer | gpt-4 | Robustness checks |

### Category F: Quality & Validation (5 agents)

| ID | Name | Model | Purpose |
|----|------|-------|---------|
| F1 | Internal Consistency Checker | gpt-3.5 | Logic flow verification |
| F2 | Checklist Manager | gpt-3.5 | CONSORT, STROBE, PRISMA |
| F3 | Reproducibility Auditor | gpt-4 | OSF, open science |
| F4 | Bias & Trustworthiness Detector | gpt-4 | Bias + qualitative trustworthiness |
| F5 | Humanization Verifier | gpt-4 | AI text transformation integrity |

### Category G: Publication (6 agents)

| ID | Name | Model | Purpose |
|----|------|-------|---------|
| G1 | Journal Matcher | gpt-4 | Find target journals |
| G2 | Academic Communicator | gpt-4 | Plain language summaries |
| G3 | Peer Review Strategist | o1 | Response to reviewers |
| G4 | Pre-registration Composer | gpt-4 | OSF, AsPredicted |
| G5 | Academic Style Auditor | gpt-4 | AI pattern detection |
| G6 | Academic Style Humanizer | gpt-4 | Transform AI patterns to natural prose |

### Category H: Specialized (2 agents)

| ID | Name | Model | Purpose |
|----|------|-------|---------|
| H1 | Ethnographic Research Advisor | o1 | Ethnographic methodology |
| H2 | Action Research Facilitator | o1 | Participatory action research |

---

## Auto-Trigger Keywords

| Keywords | Agent |
|----------|-------|
| "research question", "PICO", "SPIDER" | A1 |
| "theoretical framework", "theory" | A2 |
| "criticism", "devil's advocate" | A3 |
| "ethics", "IRB", "consent" | A4 |
| "paradigm", "epistemology" | A5 |
| "conceptual framework" | A6 |
| "literature review", "PRISMA" | B1 |
| "quality appraisal", "RoB" | B2 |
| "effect size", "Cohen's d" | B3 |
| "meta-analysis", "MASEM" | C5 |
| "phenomenology", "grounded theory" | C2 |
| "mixed methods" | C3 |
| "statistical analysis", "SEM" | E1 |
| "thematic analysis", "coding" | E2 |
`;
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
