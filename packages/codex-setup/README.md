# @diverga/codex-setup

Interactive TUI installer for Diverga Research Coordinator on OpenAI Codex CLI.

## Installation

```bash
# Using npx (recommended)
npx @diverga/codex-setup

# Using bunx
bunx @diverga/codex-setup

# Global installation
npm install -g @diverga/codex-setup
diverga-setup
```

## Features

- **Beautiful TUI**: Powered by @clack/prompts for a modern CLI experience
- **Research Paradigm Selection**: Quantitative, Qualitative, Mixed Methods, or Auto-detect
- **Language Support**: English and Korean (한국어)
- **Creativity Level**: Configure T-Score preferences (Conservative, Balanced, Innovative)
- **Checkpoint Configuration**: Choose which checkpoint levels require approval

## What Gets Installed

The setup creates the following in `~/.codex/diverga/`:

```
~/.codex/diverga/
├── config.yaml       # Your configuration
├── SKILL.md          # Codex skill definition
├── AGENTS.md         # 40 agent reference
└── skills/           # Agent skill files
```

If `~/.diverga/setup.json` and `~/.diverga/runtime/codex/diverga.toml` already exist, the installer can import them as a managed runtime bridge. In that mode, `config.yaml` keeps the legacy Codex installer settings while also recording the generated Diverga-managed artifact paths.

When available, the installer also imports managed runtime guidance defaults:
- stronger question bias in `explore`
- narrative-trace preservation in `draft`
- `why this may be wrong` requirement in `review`

## Configuration Options

### Research Paradigm
- **Auto-detect**: Diverga detects your paradigm from context
- **Quantitative**: Experimental, survey, meta-analysis
- **Qualitative**: Phenomenology, grounded theory, case study
- **Mixed Methods**: Sequential, convergent, embedded designs

### Creativity Level (T-Score)
- **Conservative (T >= 0.5)**: Safe, validated approaches
- **Balanced (T >= 0.3)**: Differentiated + defensible (recommended)
- **Innovative (T >= 0.2)**: High contribution potential

### Checkpoint Levels
- **Required**: Research direction, paradigm, theory selection
- **Recommended**: Analysis plan, integration strategy
- **Optional**: Visualization, search strategy, writing style

## 40 Research Agents

Diverga provides 40 specialized agents across 8 categories:

| Category | Agents |
|----------|--------|
| A - Research Foundation | A1-A6 |
| B - Literature & Evidence | B1-B5 |
| C - Study Design & Meta-Analysis | C1-C7 |
| D - Data Collection | D1-D4 |
| E - Analysis | E1-E5 |
| F - Quality & Validation | F1-F5 |
| G - Publication | G1-G6 |
| H - Specialized | H1-H2 |

## After Installation

Use keywords in your Codex sessions to trigger agents:

```
"research question" → A1-ResearchQuestionRefiner
"meta-analysis" → C5-MetaAnalysisMaster
"theoretical framework" → A2-TheoreticalFrameworkArchitect
```

## Managed Runtime Bridge

This package now supports a minimal bridge from the refactoring installer surface.

- managed setup input: `~/.diverga/setup.json`
- managed Codex runtime config: `~/.diverga/runtime/codex/diverga.toml`
- recorded bridge output: `~/.codex/diverga/config.yaml`

This bridge does not replace native Codex configuration. It only records and imports Diverga-managed setup artifacts so the migration path can stay incremental.

## CLI Commands

After installation, use the bundled CLI:

```bash
~/.codex/diverga/.codex/diverga-codex list       # List all agents
~/.codex/diverga/.codex/diverga-codex tscore     # T-Score reference
~/.codex/diverga/.codex/diverga-codex vs         # VS methodology
```

## Documentation

- [GitHub Repository](https://github.com/HosungYou/Diverga)
- [VS Methodology](https://github.com/HosungYou/Diverga/blob/main/docs/VS-METHODOLOGY.md)

## License

MIT
