#!/usr/bin/env node

/**
 * sync-version.js - Propagate version from package.json to all version-bearing files.
 *
 * Usage:
 *   node scripts/sync-version.js --check   # Report drift, exit 1 if any found
 *   node scripts/sync-version.js --fix     # Update all files (default)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function readText(path) {
  return readFileSync(path, 'utf-8');
}

function writeText(path, content) {
  writeFileSync(path, content, 'utf-8');
}

/** Return list of subdirectory names inside `dir`, or [] if dir missing. */
function subdirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

// ---------------------------------------------------------------------------
// Target definitions
// ---------------------------------------------------------------------------

/**
 * Each target returns { file, current, update(version) }.
 * `current` is the version string found (or null if file missing).
 * `update(version)` writes the new version in-place.
 */
function targets(version) {
  const list = [];

  // 1. pyproject.toml  -  version = "X.Y.Z" under [project]
  const pyprojectPath = join(ROOT, 'pyproject.toml');
  if (existsSync(pyprojectPath)) {
    const text = readText(pyprojectPath);
    const match = text.match(/^version\s*=\s*"([^"]+)"/m);
    list.push({
      file: 'pyproject.toml',
      current: match ? match[1] : null,
      update(v) {
        const updated = text.replace(
          /^(version\s*=\s*")[^"]+(")$/m,
          `$1${v}$2`,
        );
        writeText(pyprojectPath, updated);
      },
    });
  }

  // 2. src/index.ts  -  export const VERSION = 'X.Y.Z'  AND  JSDoc comment
  const indexTsPath = join(ROOT, 'src', 'index.ts');
  if (existsSync(indexTsPath)) {
    const text = readText(indexTsPath);
    const constMatch = text.match(/export\s+const\s+VERSION\s*=\s*'([^']+)'/);
    const jsdocMatch = text.match(/Diverga Agent Runtime v([\d.]+)/);
    // Report the const as the "current" version
    list.push({
      file: 'src/index.ts',
      current: constMatch ? constMatch[1] : null,
      update(v) {
        let updated = text;
        // Update const
        updated = updated.replace(
          /export\s+const\s+VERSION\s*=\s*'[^']+'/,
          `export const VERSION = '${v}'`,
        );
        // Update JSDoc header
        updated = updated.replace(
          /Diverga Agent Runtime v[\d.]+/,
          `Diverga Agent Runtime v${v}`,
        );
        writeText(indexTsPath, updated);
      },
    });
  }

  // 3. config/diverga-config.json  -  "version" field
  const configPath = join(ROOT, 'config', 'diverga-config.json');
  if (existsSync(configPath)) {
    const data = readJSON(configPath);
    list.push({
      file: 'config/diverga-config.json',
      current: data.version || null,
      update(v) {
        data.version = v;
        writeText(configPath, JSON.stringify(data, null, 2) + '\n');
      },
    });
  }

  // 4. skills/*/SKILL.md  -  YAML frontmatter  version: "X.Y.Z"
  const skillsDir = join(ROOT, 'skills');
  for (const name of subdirs(skillsDir)) {
    const skillPath = join(skillsDir, name, 'SKILL.md');
    if (!existsSync(skillPath)) continue;
    const text = readText(skillPath);
    const match = text.match(/^version:\s*"([^"]+)"/m);
    list.push({
      file: `skills/${name}/SKILL.md`,
      current: match ? match[1] : null,
      update(v) {
        const updated = text.replace(
          /^(version:\s*")[^"]+(")$/m,
          `$1${v}$2`,
        );
        writeText(skillPath, updated);
      },
    });
  }

  // 5. plugin.json (root)  -  "version" field
  const pluginJsonPath = join(ROOT, 'plugin.json');
  if (existsSync(pluginJsonPath)) {
    const data = readJSON(pluginJsonPath);
    list.push({
      file: 'plugin.json',
      current: data.version || null,
      update(v) {
        data.version = v;
        writeText(pluginJsonPath, JSON.stringify(data, null, 2) + '\n');
      },
    });
  }

  // 6. .claude-plugin/plugin.json  -  "version" field
  const claudePluginJsonPath = join(ROOT, '.claude-plugin', 'plugin.json');
  if (existsSync(claudePluginJsonPath)) {
    const data = readJSON(claudePluginJsonPath);
    list.push({
      file: '.claude-plugin/plugin.json',
      current: data.version || null,
      update(v) {
        data.version = v;
        writeText(claudePluginJsonPath, JSON.stringify(data, null, 2) + '\n');
      },
    });
  }

  // 7. .codex/skills/diverga-*/SKILL.md  -  metadata version field
  const codexSkillsDir = join(ROOT, '.codex', 'skills');
  for (const name of subdirs(codexSkillsDir)) {
    const skillPath = join(codexSkillsDir, name, 'SKILL.md');
    if (!existsSync(skillPath)) continue;
    const text = readText(skillPath);
    // Codex SKILL.md uses  metadata:\n  ...\n  version: X.Y.Z  (unquoted)
    const match = text.match(/^(\s*)version:\s*([\d.]+)/m);
    list.push({
      file: `.codex/skills/${name}/SKILL.md`,
      current: match ? match[2] : null,
      update(v) {
        const updated = text.replace(
          /^(\s*version:\s*)[\d.]+/m,
          `$1${v}`,
        );
        writeText(skillPath, updated);
      },
    });
  }

  return list;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');

  // Read source of truth
  const pkg = readJSON(join(ROOT, 'package.json'));
  const version = pkg.version;

  console.log(`\n${CYAN}sync-version${RESET}  source of truth: package.json ${GREEN}v${version}${RESET}\n`);

  const all = targets(version);
  let driftCount = 0;
  let updatedCount = 0;
  let okCount = 0;

  for (const t of all) {
    const isCurrent = t.current === version;

    if (isCurrent) {
      okCount++;
      console.log(`  ${GREEN}\u2713${RESET} ${DIM}${t.file}${RESET}  ${DIM}${t.current}${RESET}`);
    } else {
      driftCount++;
      if (checkOnly) {
        console.log(`  ${RED}\u2717${RESET} ${t.file}  ${RED}${t.current || '(missing)'}${RESET} ${DIM}\u2192 expected ${version}${RESET}`);
      } else {
        t.update(version);
        updatedCount++;
        console.log(`  ${YELLOW}\u2192${RESET} ${t.file}  ${RED}${t.current || '(missing)'}${RESET} \u2192 ${GREEN}${version}${RESET}`);
      }
    }
  }

  // Summary
  console.log('');
  console.log(`  ${DIM}Files checked:${RESET}  ${all.length}`);
  console.log(`  ${DIM}Up to date:${RESET}    ${okCount}`);

  if (checkOnly) {
    console.log(`  ${DIM}Drifted:${RESET}       ${driftCount}`);
    if (driftCount > 0) {
      console.log(`\n${RED}Version drift detected.${RESET} Run ${CYAN}node scripts/sync-version.js --fix${RESET} to update.\n`);
      process.exit(1);
    } else {
      console.log(`\n${GREEN}All versions in sync.${RESET}\n`);
    }
  } else {
    console.log(`  ${DIM}Updated:${RESET}       ${updatedCount}`);
    if (updatedCount > 0) {
      console.log(`\n${GREEN}All versions synced to ${version}.${RESET}\n`);
    } else {
      console.log(`\n${GREEN}All versions already in sync.${RESET}\n`);
    }
  }
}

main();
