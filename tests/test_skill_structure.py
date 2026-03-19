#!/usr/bin/env python3
"""
Tests for SKILL.md Structural Integrity
=========================================

Validates that every skill directory exists, contains a valid SKILL.md
with correct YAML frontmatter, uses only allowed fields, and that the
skill inventory matches the expected agent and system skill breakdown.

Usage:
    pytest tests/test_skill_structure.py -v
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

BASE_DIR = Path(__file__).parent.parent
SKILLS_DIR = BASE_DIR / "skills"

# 24 core agent skill directories (v12.0 — consolidated from 44)
AGENT_SKILLS = [
    "a1", "a2", "a5",
    "b1", "b2",
    "c1", "c2", "c3", "c5",
    "d2", "d4",
    "e1", "e2", "e3",
    "f5",
    "g1", "g2", "g5", "g6",
    "i0", "i1", "i2", "i3",
    "x1",
]

# 10 system/utility skill directories
SYSTEM_SKILLS = [
    "diverga",
    "doctor",
    "help",
    "hud",
    "humanize",
    "memory",
    "orchestrator",
    "research-coordinator",
    "setup",
    "universal-ma-codebook",
]

ALL_EXPECTED_SKILLS = sorted(AGENT_SKILLS + SYSTEM_SKILLS)

# Only these fields are supported in SKILL.md frontmatter per CLAUDE.md developer notes
ALLOWED_FRONTMATTER_FIELDS = {"name", "description", "version"}

# Fields that are known to break skill recognition
UNSUPPORTED_FIELDS = {"command", "category", "model_tier", "triggers", "dependencies"}


def _parse_frontmatter_fields(skill_md: Path) -> dict[str, str] | None:
    """Parse frontmatter from SKILL.md and return raw key-value pairs.

    Returns None if no valid frontmatter is found.
    """
    content = skill_md.read_text(encoding="utf-8")
    if not content.startswith("---"):
        return None

    try:
        end_idx = content.index("---", 3)
    except ValueError:
        return None

    frontmatter_text = content[3:end_idx].strip()
    fields: dict[str, str] = {}

    for line in frontmatter_text.split("\n"):
        # Only consider top-level keys (no indentation)
        if line and not line[0].isspace() and ":" in line:
            key = line.split(":", 1)[0].strip()
            fields[key] = line.split(":", 1)[1].strip()

    return fields


class TestSkillDirectoryInventory:
    """Tests that all expected skill directories exist."""

    def test_skills_directory_exists(self):
        """The skills/ directory must exist at the repository root."""
        assert SKILLS_DIR.exists(), f"skills/ directory not found at {SKILLS_DIR}"
        assert SKILLS_DIR.is_dir(), f"{SKILLS_DIR} is not a directory"

    def test_all_agent_skill_directories_exist(self):
        """All 24 core agent skill directories must exist under skills/."""
        missing = [
            name for name in AGENT_SKILLS
            if not (SKILLS_DIR / name).is_dir()
        ]
        assert not missing, (
            f"Missing agent skill directories: {missing}"
        )

    def test_agent_skill_count(self):
        """There must be exactly 24 agent skill directories."""
        existing = [
            name for name in AGENT_SKILLS
            if (SKILLS_DIR / name).is_dir()
        ]
        assert len(existing) == 24, (
            f"Expected 24 agent skill directories, found {len(existing)}"
        )

    def test_all_system_skill_directories_exist(self):
        """All 10 system skill directories must exist under skills/."""
        missing = [
            name for name in SYSTEM_SKILLS
            if not (SKILLS_DIR / name).is_dir()
        ]
        assert not missing, (
            f"Missing system skill directories: {missing}"
        )

    def test_system_skill_count(self):
        """There must be exactly 10 system skill directories."""
        existing = [
            name for name in SYSTEM_SKILLS
            if (SKILLS_DIR / name).is_dir()
        ]
        assert len(existing) == 10, (
            f"Expected 10 system skill directories, found {len(existing)}"
        )

    def test_total_skill_count(self):
        """Total skill directories with SKILL.md must be 34 (24 agents + 10 system)."""
        actual_dirs = sorted(
            d.name for d in SKILLS_DIR.iterdir()
            if d.is_dir() and (d / "SKILL.md").exists()
        )
        assert len(actual_dirs) == 34, (
            f"Expected 34 skill directories, found {len(actual_dirs)}: {actual_dirs}"
        )

    def test_no_unexpected_skill_directories(self):
        """No unexpected skill directories should exist beyond the known set."""
        actual_dirs = sorted(
            d.name for d in SKILLS_DIR.iterdir()
            if d.is_dir() and (d / "SKILL.md").exists()
        )
        unexpected = [d for d in actual_dirs if d not in ALL_EXPECTED_SKILLS]
        assert not unexpected, (
            f"Unexpected skill directories found: {unexpected}"
        )


class TestSkillMdPresence:
    """Tests that every skill directory contains a SKILL.md file."""

    def test_every_skill_directory_has_skill_md(self):
        """Every expected skill directory must contain a SKILL.md file."""
        missing_skill_md = []
        for name in ALL_EXPECTED_SKILLS:
            skill_dir = SKILLS_DIR / name
            if skill_dir.is_dir() and not (skill_dir / "SKILL.md").exists():
                missing_skill_md.append(name)

        assert not missing_skill_md, (
            f"Skill directories missing SKILL.md: {missing_skill_md}"
        )


class TestFrontmatterValidity:
    """Tests that SKILL.md frontmatter is valid and well-formed."""

    def test_all_skills_have_frontmatter(self):
        """Every SKILL.md must start with YAML frontmatter (--- delimiters)."""
        no_frontmatter = []
        for name in ALL_EXPECTED_SKILLS:
            skill_md = SKILLS_DIR / name / "SKILL.md"
            if not skill_md.exists():
                continue
            content = skill_md.read_text(encoding="utf-8")
            if not content.startswith("---"):
                no_frontmatter.append(name)

        assert not no_frontmatter, (
            f"Skills missing YAML frontmatter: {no_frontmatter}"
        )

    def test_all_skills_have_closing_frontmatter(self):
        """Every SKILL.md frontmatter must have a closing --- delimiter."""
        unclosed = []
        for name in ALL_EXPECTED_SKILLS:
            skill_md = SKILLS_DIR / name / "SKILL.md"
            if not skill_md.exists():
                continue
            content = skill_md.read_text(encoding="utf-8")
            if content.startswith("---"):
                try:
                    content.index("---", 3)
                except ValueError:
                    unclosed.append(name)

        assert not unclosed, (
            f"Skills with unclosed frontmatter (missing closing ---): {unclosed}"
        )

    def test_all_skills_have_name_field(self):
        """Every SKILL.md frontmatter must contain a 'name' field."""
        missing_name = []
        for name in ALL_EXPECTED_SKILLS:
            skill_md = SKILLS_DIR / name / "SKILL.md"
            if not skill_md.exists():
                continue
            fields = _parse_frontmatter_fields(skill_md)
            if fields is None or "name" not in fields:
                missing_name.append(name)

        assert not missing_name, (
            f"Skills missing 'name' in frontmatter: {missing_name}"
        )

    def test_all_skills_have_description_field(self):
        """Every SKILL.md frontmatter must contain a 'description' field."""
        missing_desc = []
        for name in ALL_EXPECTED_SKILLS:
            skill_md = SKILLS_DIR / name / "SKILL.md"
            if not skill_md.exists():
                continue
            fields = _parse_frontmatter_fields(skill_md)
            if fields is None or "description" not in fields:
                missing_desc.append(name)

        assert not missing_desc, (
            f"Skills missing 'description' in frontmatter: {missing_desc}"
        )

    def test_all_skills_have_version_field(self):
        """Every SKILL.md frontmatter must contain a 'version' field."""
        missing_version = []
        for name in ALL_EXPECTED_SKILLS:
            skill_md = SKILLS_DIR / name / "SKILL.md"
            if not skill_md.exists():
                continue
            fields = _parse_frontmatter_fields(skill_md)
            if fields is None or "version" not in fields:
                missing_version.append(name)

        assert not missing_version, (
            f"Skills missing 'version' in frontmatter: {missing_version}"
        )


class TestFrontmatterFieldRestrictions:
    """Tests that SKILL.md frontmatter uses only allowed fields."""

    def test_no_unsupported_fields_in_frontmatter(self):
        """No SKILL.md should use unsupported frontmatter fields.

        Per CLAUDE.md developer notes, only name/description/version are supported.
        Fields like command, category, model_tier, triggers, dependencies break
        skill recognition.
        """
        violations = []
        for name in ALL_EXPECTED_SKILLS:
            skill_md = SKILLS_DIR / name / "SKILL.md"
            if not skill_md.exists():
                continue
            fields = _parse_frontmatter_fields(skill_md)
            if fields is None:
                continue
            bad_fields = set(fields.keys()) & UNSUPPORTED_FIELDS
            if bad_fields:
                violations.append((name, sorted(bad_fields)))

        assert not violations, (
            "Skills using unsupported frontmatter fields "
            "(causes 'Unknown skill' error):\n"
            + "\n".join(f"  {name}: {fields}" for name, fields in violations)
        )

    def test_frontmatter_only_has_allowed_fields(self):
        """Every SKILL.md should only use the allowed frontmatter fields.

        Allowed: name, description, version.
        Any other top-level field is a potential problem.
        """
        violations = []
        for name in ALL_EXPECTED_SKILLS:
            skill_md = SKILLS_DIR / name / "SKILL.md"
            if not skill_md.exists():
                continue
            fields = _parse_frontmatter_fields(skill_md)
            if fields is None:
                continue
            extra = set(fields.keys()) - ALLOWED_FRONTMATTER_FIELDS
            if extra:
                violations.append((name, sorted(extra)))

        if violations:
            details = "\n".join(
                f"  {name}: extra fields {fields}" for name, fields in violations
            )
            pytest.fail(
                f"Skills with fields outside allowed set "
                f"{sorted(ALLOWED_FRONTMATTER_FIELDS)}:\n{details}"
            )


class TestVersionFieldFormat:
    """Tests that version fields are properly formatted."""

    def test_version_is_quoted_string(self):
        """Version field in frontmatter must be a quoted string like '"11.1.0"'."""
        unquoted = []
        for name in ALL_EXPECTED_SKILLS:
            skill_md = SKILLS_DIR / name / "SKILL.md"
            if not skill_md.exists():
                continue

            content = skill_md.read_text(encoding="utf-8")
            if not content.startswith("---"):
                continue

            try:
                end_idx = content.index("---", 3)
            except ValueError:
                continue

            frontmatter = content[3:end_idx]
            # Look for version line
            for line in frontmatter.split("\n"):
                stripped = line.strip()
                if stripped.startswith("version:"):
                    value = stripped.split(":", 1)[1].strip()
                    # Must be wrapped in quotes
                    if not (
                        (value.startswith('"') and value.endswith('"'))
                        or (value.startswith("'") and value.endswith("'"))
                    ):
                        unquoted.append(name)
                    break

        assert not unquoted, (
            f"Skills with unquoted version field (must quote version): {unquoted}"
        )

    def test_version_follows_semver(self):
        """Version field must follow semantic versioning (X.Y.Z)."""
        invalid = []
        semver_pattern = re.compile(r"^\d+\.\d+\.\d+$")

        for name in ALL_EXPECTED_SKILLS:
            skill_md = SKILLS_DIR / name / "SKILL.md"
            if not skill_md.exists():
                continue

            fields = _parse_frontmatter_fields(skill_md)
            if fields is None or "version" not in fields:
                continue

            version = fields["version"].strip('"').strip("'")
            if not semver_pattern.match(version):
                invalid.append((name, version))

        assert not invalid, (
            "Skills with non-semver version:\n"
            + "\n".join(f"  {name}: '{ver}'" for name, ver in invalid)
        )
