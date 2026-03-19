#!/usr/bin/env python3
"""
Tests for Version Consistency across Diverga v12.0.0
=====================================================

Ensures ALL version references across the codebase match v12.0.0.
Catches version drift between package.json, pyproject.toml, plugin.json,
marketplace.json, config, SKILL.md frontmatter, CLAUDE.md, and README.md.

Usage:
    pytest tests/test_version_consistency.py -v
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

BASE_DIR = Path(__file__).parent.parent
EXPECTED_VERSION = "12.0.0"


class TestPackageVersions:
    """Tests that top-level package manifests declare the correct version."""

    def test_package_json_version(self):
        """package.json version field must equal the expected version."""
        pkg_path = BASE_DIR / "package.json"
        assert pkg_path.exists(), f"package.json not found at {pkg_path}"

        data = json.loads(pkg_path.read_text(encoding="utf-8"))
        assert "version" in data, "package.json missing 'version' field"
        assert data["version"] == EXPECTED_VERSION, (
            f"package.json version is '{data['version']}', expected '{EXPECTED_VERSION}'"
        )

    def test_pyproject_toml_version(self):
        """pyproject.toml [project] version must equal the expected version."""
        toml_path = BASE_DIR / "pyproject.toml"
        assert toml_path.exists(), f"pyproject.toml not found at {toml_path}"

        content = toml_path.read_text(encoding="utf-8")
        # Parse version from [project] section using regex (no toml dependency)
        match = re.search(r'^\s*version\s*=\s*"([^"]+)"', content, re.MULTILINE)
        assert match is not None, "pyproject.toml missing version field in [project]"
        assert match.group(1) == EXPECTED_VERSION, (
            f"pyproject.toml version is '{match.group(1)}', expected '{EXPECTED_VERSION}'"
        )


class TestPluginMetadataVersions:
    """Tests that plugin metadata files declare the correct version."""

    def test_plugin_json_version(self):
        """plugin.json version must equal the expected version."""
        plugin_path = BASE_DIR / ".claude-plugin" / "plugin.json"
        assert plugin_path.exists(), f"plugin.json not found at {plugin_path}"

        data = json.loads(plugin_path.read_text(encoding="utf-8"))
        assert "version" in data, "plugin.json missing 'version' field"
        assert data["version"] == EXPECTED_VERSION, (
            f"plugin.json version is '{data['version']}', expected '{EXPECTED_VERSION}'"
        )

    def test_marketplace_json_plugin_version(self):
        """marketplace.json plugins[0].version must equal the expected version."""
        mp_path = BASE_DIR / ".claude-plugin" / "marketplace.json"
        assert mp_path.exists(), f"marketplace.json not found at {mp_path}"

        data = json.loads(mp_path.read_text(encoding="utf-8"))
        assert "plugins" in data, "marketplace.json missing 'plugins' array"
        assert len(data["plugins"]) > 0, "marketplace.json 'plugins' array is empty"

        plugin_version = data["plugins"][0].get("version")
        assert plugin_version is not None, (
            "marketplace.json plugins[0] missing 'version' field"
        )
        assert plugin_version == EXPECTED_VERSION, (
            f"marketplace.json plugin version is '{plugin_version}', "
            f"expected '{EXPECTED_VERSION}'"
        )

    def test_diverga_config_version(self):
        """config/diverga-config.json version must equal the expected version."""
        config_path = BASE_DIR / "config" / "diverga-config.json"
        assert config_path.exists(), f"diverga-config.json not found at {config_path}"

        data = json.loads(config_path.read_text(encoding="utf-8"))
        assert "version" in data, "diverga-config.json missing 'version' field"
        assert data["version"] == EXPECTED_VERSION, (
            f"diverga-config.json version is '{data['version']}', "
            f"expected '{EXPECTED_VERSION}'"
        )


class TestSkillVersions:
    """Tests that every SKILL.md frontmatter declares the correct version."""

    @staticmethod
    def _extract_frontmatter_version(skill_path: Path) -> str | None:
        """Extract the version field from SKILL.md YAML frontmatter."""
        content = skill_path.read_text(encoding="utf-8")
        if not content.startswith("---"):
            return None

        try:
            end_idx = content.index("---", 3)
        except ValueError:
            return None

        frontmatter = content[3:end_idx]
        # Match version line: version: "X.Y.Z" or version: X.Y.Z
        match = re.search(
            r'^version:\s*["\']?([^"\'\n]+)["\']?\s*$',
            frontmatter,
            re.MULTILINE,
        )
        return match.group(1).strip() if match else None

    def test_all_skills_have_correct_version(self):
        """Every SKILL.md in skills/ must have version matching the expected version."""
        skills_dir = BASE_DIR / "skills"
        assert skills_dir.exists(), f"skills/ directory not found at {skills_dir}"

        skill_dirs = sorted(
            d for d in skills_dir.iterdir() if d.is_dir() and (d / "SKILL.md").exists()
        )
        assert len(skill_dirs) > 0, "No skill directories with SKILL.md found"

        mismatched = []
        missing_version = []

        for skill_dir in skill_dirs:
            skill_md = skill_dir / "SKILL.md"
            version = self._extract_frontmatter_version(skill_md)
            if version is None:
                missing_version.append(skill_dir.name)
            elif version != EXPECTED_VERSION:
                mismatched.append((skill_dir.name, version))

        errors = []
        if missing_version:
            errors.append(
                f"Skills missing version in frontmatter: {missing_version}"
            )
        if mismatched:
            details = ", ".join(f"{name}={ver}" for name, ver in mismatched)
            errors.append(
                f"Skills with wrong version (expected {EXPECTED_VERSION}): {details}"
            )

        assert not errors, "\n".join(errors)

    def test_skill_count_matches_expected(self):
        """The total number of skills with SKILL.md should be 34."""
        skills_dir = BASE_DIR / "skills"
        skill_dirs = sorted(
            d for d in skills_dir.iterdir() if d.is_dir() and (d / "SKILL.md").exists()
        )
        assert len(skill_dirs) == 34, (
            f"Expected 34 skill directories with SKILL.md, found {len(skill_dirs)}: "
            f"{[d.name for d in skill_dirs]}"
        )


class TestDocumentationVersions:
    """Tests that documentation files reference the correct version."""

    def test_claude_md_header_contains_version(self):
        """CLAUDE.md header line must contain 'v8.0.1'."""
        claude_md = BASE_DIR / "CLAUDE.md"
        assert claude_md.exists(), f"CLAUDE.md not found at {claude_md}"

        content = claude_md.read_text(encoding="utf-8")
        # Check the first heading line for version reference
        header_match = re.search(
            r"^#\s+.*v" + re.escape(EXPECTED_VERSION), content, re.MULTILINE
        )
        assert header_match is not None, (
            f"CLAUDE.md header does not contain 'v{EXPECTED_VERSION}'. "
            "Check the top-level heading for version string."
        )

    def test_readme_badge_shows_version(self):
        """README.md version badge must show the expected version."""
        readme_path = BASE_DIR / "README.md"
        assert readme_path.exists(), f"README.md not found at {readme_path}"

        content = readme_path.read_text(encoding="utf-8")
        # Badge format: version-8.0.1- in shields.io URL
        badge_pattern = re.compile(
            r"version-" + re.escape(EXPECTED_VERSION) + r"-"
        )
        assert badge_pattern.search(content) is not None, (
            f"README.md badge does not show version {EXPECTED_VERSION}. "
            "Expected shields.io badge with 'version-8.0.1-' pattern."
        )


class TestVersionFormatConsistency:
    """Tests that version values use consistent formatting."""

    def test_skill_versions_are_quoted_strings(self):
        """All SKILL.md version fields must be quoted strings in frontmatter."""
        skills_dir = BASE_DIR / "skills"
        unquoted = []

        for skill_dir in sorted(skills_dir.iterdir()):
            skill_md = skill_dir / "SKILL.md"
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
            # Check for unquoted version: version: 8.0.1 (no quotes)
            if re.search(r'^version:\s+\d+\.\d+\.\d+\s*$', frontmatter, re.MULTILINE):
                unquoted.append(skill_dir.name)

        assert not unquoted, (
            f"Skills with unquoted version (must use quotes): {unquoted}"
        )
