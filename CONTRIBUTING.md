# Contributing to Diverga

Thank you for your interest in contributing to Diverga! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Agent Development Guide](#agent-development-guide)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Code of Conduct

This project follows a simple code of conduct:

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the work, not the person
- Help others learn and grow

---

## Getting Started

### Prerequisites

- Git
- Bash shell (macOS/Linux)
- Python 3.8+ (for validation scripts)
- Claude Code CLI (for testing agents)

### Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/Diverga.git
cd Diverga

# Add upstream remote
git remote add upstream https://github.com/HosungYou/Diverga.git
```

---

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Activate Dev Mode

Dev mode creates selective symlinks so your source changes reflect immediately
in the plugin cache — no reinstall needed.

```bash
npm run dev:on       # Activate
npm run dev:status   # Verify
```

### 3. Build TypeScript

```bash
npm run build        # One-time build
npm run build:watch  # Watch mode for continuous development
```

### 4. Run Validation

```bash
npm run test:all     # Typecheck + version check + generate check
```

### 5. Deactivate Dev Mode

When done developing:
```bash
npm run dev:off      # Restore original cache
```

### Deploy a Release

```bash
npm run deploy -- patch    # or minor, major
```

This runs the full pipeline: validate → build → version sync → git → GitHub Release → cache refresh.

---

## How to Contribute

### Types of Contributions

| Type | Description |
|------|-------------|
| **Bug Reports** | Report issues with agents or documentation |
| **Feature Requests** | Suggest new agents or improvements |
| **Documentation** | Improve docs, fix typos, add examples |
| **Agent Development** | Create new agents or enhance existing ones |
| **Translations** | Help translate documentation |
| **Code Quality** | Improve validation, testing, tooling |

### Creating Issues

Before creating an issue:
1. Search existing issues to avoid duplicates
2. Use the appropriate issue template
3. Provide as much context as possible

### Issue Templates

**Bug Report:**
```markdown
**Agent**: 02-theoretical-framework-architect
**Version**: 8.4.0
**Description**: [What happened?]
**Expected**: [What should happen?]
**Steps to Reproduce**: [How to reproduce?]
```

**Feature Request:**
```markdown
**Category**: [Agent / Documentation / Tooling]
**Description**: [What would you like?]
**Use Case**: [Why is this useful?]
**Alternatives**: [Have you considered alternatives?]
```

---

## Pull Request Process

### 1. Create a Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Follow the [coding standards](#coding-standards)
- Write clear commit messages
- Keep commits focused and atomic

### 3. Validate Changes

```bash
# Validate all agents
./scripts/rc validate

# Run specific validations
./scripts/rc validate 02  # For agent 02
```

### 4. Submit PR

```bash
# Push to your fork
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title and description
- Reference to related issues
- List of changes made
- Screenshots if applicable

### PR Checklist

- [ ] Follows coding standards
- [ ] Validation passes (`./scripts/rc validate`)
- [ ] Documentation updated if needed
- [ ] Commit messages are clear
- [ ] No breaking changes (or documented)

---

## Coding Standards

### SKILL.md Files

Every agent SKILL.md must include:

```yaml
---
name: agent-name                    # kebab-case
version: "X.Y.Z"                    # Semantic versioning
description: |
  Multi-line description...
upgrade_level: FULL | ENHANCED | LIGHT
v3_integration:
  dynamic_t_score: true | false
  creativity_modules: [...]
  checkpoints: [...]
---

# Agent Title

## Overview
[What does this agent do?]

## VS-Research Process
[How does it apply VS methodology?]

## Input Requirements
[What inputs are needed?]

## Output Format
[What outputs are produced?]

## Examples
[Usage examples]

## Related Agents
[Links to related agents]
```

### Markdown Standards

- Use ATX-style headers (`#`, `##`, `###`)
- One sentence per line for easy diffs
- Use fenced code blocks with language tags
- Include alt text for images

### Python Scripts

- Use type hints
- Follow PEP 8 style guide
- Include docstrings
- No external dependencies if possible

```python
#!/usr/bin/env python3
"""
Module description.

Usage:
    python script.py [options]
"""

from __future__ import annotations

def function_name(param: str) -> bool:
    """
    Function description.

    Args:
        param: Parameter description.

    Returns:
        Return value description.
    """
    pass
```

### Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `chore`: Maintenance
- `refactor`: Code refactoring
- `test`: Testing

Examples:
```
feat(agent): add 22-meta-analysis-assistant
docs(readme): add quick start guide
fix(agent-02): correct T-Score calculation
chore(scripts): update validation tool
```

---

## Agent Development Guide

### Creating a New Agent

1. **Choose a number and name:**
   ```
   22-your-agent-name/
   └── SKILL.md
   ```

2. **Determine VS level:**
   - **FULL**: Complex reasoning, 5 creativity modules, 6+ checkpoints
   - **ENHANCED**: Moderate complexity, 3 modules, 3+ checkpoints
   - **LIGHT**: Simple tasks, basic modal awareness

3. **Create SKILL.md:**
   - Use an existing agent as template
   - Follow the frontmatter schema
   - Include all required sections

4. **Register in agent-registry.yaml:**
   ```yaml
   "22-your-agent-name":
     name: "Your Agent Name"
     icon: "🆕"
     category: "E - Publication"
     vs_level: "Enhanced"
     # ... other fields
   ```

5. **Validate:**
   ```bash
   ./scripts/rc validate 22
   ```

### VS Methodology Guidelines

When implementing VS methodology:

1. **Phase 0: Context Collection**
   - Gather research domain, stage, constraints

2. **Phase 1: Modal Identification**
   - Identify T > 0.8 options
   - Explicitly list "avoid these"

3. **Phase 2: Long-Tail Sampling**
   - Generate 3+ alternatives
   - Assign T-Scores with justification

4. **Phase 3: Selection**
   - Choose based on context
   - Document rationale

5. **Phase 4: Execution**
   - Implement selected approach
   - Maintain academic rigor

6. **Phase 5: Verification**
   - Self-critique
   - Check "Would 80% of AIs give this answer?"

---

## Testing

### Validation Testing

```bash
# Validate all agents
./scripts/rc validate

# Validate specific agent
./scripts/rc validate 02

# Verbose output
python scripts/validate_agents.py --verbose

# JSON output
python scripts/validate_agents.py --json
```

### Manual Testing

1. Install the skill
2. Invoke in Claude Code: `/research-coordinator`
3. Test with sample prompts
4. Verify VS methodology is applied

### Test Prompts

Include test prompts in your PR:

```markdown
**Test Prompt 1:**
"AI 기반 학습 시스템의 효과에 대한 메타분석을 계획하고 있어요"

**Expected Behavior:**
- Agent 05 (Systematic Literature Scout) activates
- VS methodology applied (FULL)
- T-Scores provided for search strategies
```

---

## Documentation

### Types of Documentation

| Type | Location | Purpose |
|------|----------|---------|
| README.md | Root | Project overview |
| docs/SETUP.md | docs/ | Installation guide |
| docs/USAGE-EXAMPLES.md | docs/ | Usage examples |
| SKILL.md | Each agent | Agent documentation |
| CONTRIBUTING.md | Root | This file |

### Documentation Standards

- Write for researchers, not developers
- Include both Korean and English when possible
- Provide concrete examples
- Keep language simple and clear

### Updating Documentation

When making changes:
1. Update relevant SKILL.md files
2. Update docs/ if needed
3. Update README.md if features change
4. Update CHANGELOG.md

---

## Anti-Patterns (Don't Do This)

### ❌ Avoid These Mistakes

| Anti-Pattern | Why It's Bad | Do This Instead |
|--------------|--------------|-----------------|
| Require command-line knowledge | Target users are non-technical researchers | Use guided wizard with AskUserQuestion |
| Bypass human checkpoints | Violates core principle of human decision-making | Always pause at REQUIRED checkpoints |
| Remove VS methodology | Causes mode collapse (same recommendations) | Maintain T-Score based exploration |
| Add features without docs | Users won't discover them | Document in SKILL.md and /docs |
| English-only triggers | Excludes Korean researchers | Add both EN and KO keywords |
| Overly technical language | Alienates target users | Use accessible language |

### ✅ Good Practices

```markdown
# Good: Guided interaction
[AskUserQuestion Tool]
Question: "Which research design fits your study?"
Options:
1. Systematic Review
2. Meta-Analysis
3. Experimental Study

# Bad: Requires command knowledge
Use /research-design-consultant --type=experimental
```

```markdown
# Good: Bilingual triggers
Trigger Keywords:
- English: statistics, ANOVA, regression
- Korean: 통계, 분산분석, 회귀

# Bad: English only
Trigger Keywords: statistics, ANOVA, regression
```

---

## Core Principles

> **"Human decisions remain with humans. AI handles what's beyond human scope."**
> "인간이 할 일은 인간이, AI는 인간의 범주를 벗어난 것을 수행"

All contributions must respect this principle:
- REQUIRED checkpoints cannot be bypassed
- VS methodology prevents AI mode collapse
- Context persistence supports (not replaces) human judgment

---

## Questions?

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and ideas
- **Email**: [Contact maintainer]

Thank you for contributing!
