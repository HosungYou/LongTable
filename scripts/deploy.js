#!/usr/bin/env node

/**
 * deploy.js - One-command release pipeline for Diverga plugin.
 *
 * Usage:
 *   node scripts/deploy.js patch           # Patch release + cache refresh
 *   node scripts/deploy.js minor           # Minor release + cache refresh
 *   node scripts/deploy.js major           # Major release + cache refresh
 *   node scripts/deploy.js patch --dry-run # Preview only
 *   node scripts/deploy.js --help          # Show usage
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, cpSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const PLUGIN_NAME = 'diverga';
const PLUGINS_BASE = join(process.env.HOME, '.claude', 'plugins');
const CACHE_BASE = join(PLUGINS_BASE, 'cache', PLUGIN_NAME, PLUGIN_NAME);
const INSTALLED_PLUGINS_PATH = join(PLUGINS_BASE, 'installed_plugins.json');
const DEV_STATE_FILE = join(ROOT, '.dev-mode.json');

// Same allowlist as dev.js — items to copy to cache
const DEPLOY_ALLOWLIST = [
  'agents',
  'skills',
  'mcp',
  'hooks',
  'config',
  'dist',
  'src',
  'lib',
  'docs',
  '.claude-plugin',
  '.claude',
  '.mcp.json',
  'CLAUDE.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'README.md',
  'CHANGELOG.md',
  'plugin.json',
  'package.json',
  'pyproject.toml',
  'LICENSE',
];

// Paths to exclude during cache copy
const DEPLOY_EXCLUDE = [
  'node_modules',
  '.git',
  '.DS_Store',
  '__pycache__',
  '.pytest_cache',
  '*.db',
  '*.sqlite',
  '*.log',
];

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function run(cmd, opts = {}) {
  console.log(`  ${DIM}$ ${cmd}${RESET}`);
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts });
}

function runSilent(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' }).trim();
}

function shouldExclude(name) {
  return DEPLOY_EXCLUDE.some(pattern => {
    if (pattern.startsWith('*')) return name.endsWith(pattern.slice(1));
    return name === pattern;
  });
}

function copyFiltered(src, dest) {
  if (!existsSync(src)) return;
  const entries = readdirSync(src, { withFileTypes: true });
  mkdirSync(dest, { recursive: true });
  for (const entry of entries) {
    if (shouldExclude(entry.name)) continue;
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFiltered(srcPath, destPath);
    } else {
      cpSync(srcPath, destPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

function preflight(dryRun) {
  console.log(`\n${BOLD}[1/6] Pre-flight checks${RESET}\n`);

  // Check dev mode
  if (existsSync(DEV_STATE_FILE)) {
    if (dryRun) {
      console.log(`  ${YELLOW}\u26a0${RESET} Dev mode is active (would deactivate)`);
    } else {
      console.log(`  ${YELLOW}\u26a0${RESET} Dev mode active \u2014 deactivating...`);
      run('node scripts/dev.js off');
    }
  } else {
    console.log(`  ${GREEN}\u2713${RESET} Dev mode inactive`);
  }

  // Check git clean
  const status = runSilent('git status --porcelain');
  if (status.length > 0) {
    console.log(`  ${RED}\u2717${RESET} Working tree not clean:`);
    console.log(status);
    if (!dryRun) process.exit(1);
  } else {
    console.log(`  ${GREEN}\u2713${RESET} Working tree clean`);
  }

  // Check branch
  const branch = runSilent('git rev-parse --abbrev-ref HEAD');
  if (branch !== 'main') {
    console.log(`  ${YELLOW}\u26a0${RESET} Not on main branch (current: ${branch})`);
  } else {
    console.log(`  ${GREEN}\u2713${RESET} On main branch`);
  }
}

function buildAndValidate(dryRun) {
  console.log(`\n${BOLD}[2/6] Build & validate${RESET}\n`);

  if (dryRun) {
    console.log(`  ${DIM}(dry run: would run generate, build, validate)${RESET}`);
    return;
  }

  run('npm run generate');
  run('npm run generate:check');
  run('npm run build');
  run('npm run version:check');
}

function bumpVersion(bump, dryRun) {
  console.log(`\n${BOLD}[3/6] Version bump${RESET}\n`);

  const pkg = readJSON(join(ROOT, 'package.json'));
  const oldVersion = pkg.version;
  const [major, minor, patch] = oldVersion.split('.').map(Number);

  let newVersion;
  switch (bump) {
    case 'patch': newVersion = `${major}.${minor}.${patch + 1}`; break;
    case 'minor': newVersion = `${major}.${minor + 1}.0`; break;
    case 'major': newVersion = `${major + 1}.0.0`; break;
    default: newVersion = bump;
  }

  console.log(`  ${DIM}Current:${RESET} ${oldVersion}`);
  console.log(`  ${DIM}New:${RESET}     ${GREEN}${newVersion}${RESET}`);

  if (!dryRun) {
    run(`node scripts/sync-version.js --fix --version ${newVersion}`, { silent: true });
    console.log(`  ${GREEN}\u2713${RESET} Version synced across all files`);
  }

  return { oldVersion, newVersion };
}

function gitCommitAndTag(newVersion, dryRun) {
  console.log(`\n${BOLD}[4/6] Git commit & tag${RESET}\n`);

  if (dryRun) {
    console.log(`  ${DIM}(dry run: would commit and tag v${newVersion})${RESET}`);
    return;
  }

  run('git add -A');
  run(`git commit -m "release: v${newVersion}"`);
  run(`git tag v${newVersion}`);
  run('git push origin main --tags');
  console.log(`  ${GREEN}\u2713${RESET} Pushed v${newVersion} with tag`);
}

function githubRelease(newVersion, dryRun) {
  console.log(`\n${BOLD}[5/6] GitHub Release${RESET}\n`);

  if (dryRun) {
    console.log(`  ${DIM}(dry run: would create GitHub release for v${newVersion})${RESET}`);
    return;
  }

  try {
    run(`gh release create v${newVersion} --generate-notes`);
    console.log(`  ${GREEN}\u2713${RESET} GitHub release created`);
  } catch {
    console.log(`  ${YELLOW}\u26a0${RESET} GitHub release failed (create manually if needed)`);
  }
}

function refreshCache(newVersion, dryRun) {
  console.log(`\n${BOLD}[6/6] Cache refresh${RESET}\n`);

  const newCachePath = join(CACHE_BASE, newVersion);

  if (dryRun) {
    console.log(`  ${DIM}(dry run: would create cache at ${newCachePath})${RESET}`);
    return;
  }

  // Remove old cache versions (except .bak which dev.js manages)
  if (existsSync(CACHE_BASE)) {
    const entries = readdirSync(CACHE_BASE, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.endsWith('.bak')) {
        rmSync(join(CACHE_BASE, entry.name), { recursive: true, force: true });
        console.log(`  ${DIM}Removed old cache: ${entry.name}${RESET}`);
      }
    }
  }

  // Copy allowlisted items to new cache
  mkdirSync(newCachePath, { recursive: true });

  for (const item of DEPLOY_ALLOWLIST) {
    const sourcePath = join(ROOT, item);
    const targetPath = join(newCachePath, item);
    if (!existsSync(sourcePath)) continue;

    if (statSync(sourcePath).isDirectory()) {
      copyFiltered(sourcePath, targetPath);
    } else {
      cpSync(sourcePath, targetPath);
    }
  }

  // Install MCP dependencies in cache
  const mcpCachePath = join(newCachePath, 'mcp');
  if (existsSync(join(mcpCachePath, 'package.json'))) {
    console.log(`  ${DIM}Installing MCP dependencies...${RESET}`);
    execSync('npm install --production', { cwd: mcpCachePath, stdio: 'pipe' });
    console.log(`  ${GREEN}\u2713${RESET} MCP dependencies installed`);
  }

  console.log(`  ${GREEN}\u2713${RESET} Cache populated at ${newCachePath}`);

  // Update installed_plugins.json
  if (existsSync(INSTALLED_PLUGINS_PATH)) {
    const plugins = readJSON(INSTALLED_PLUGINS_PATH);
    const key = `${PLUGIN_NAME}@${PLUGIN_NAME}`;
    if (plugins.plugins?.[key]?.[0]) {
      const entry = plugins.plugins[key][0];
      const commitSha = runSilent('git rev-parse HEAD');
      entry.version = newVersion;
      entry.installPath = newCachePath;
      entry.gitCommitSha = commitSha;
      entry.lastUpdated = new Date().toISOString();
      // Clean up dev mode artifacts if present
      delete entry._originalVersion;
      delete entry._originalInstallPath;
      writeJSON(INSTALLED_PLUGINS_PATH, plugins);
      console.log(`  ${GREEN}\u2713${RESET} installed_plugins.json updated`);
    }
  }
}

function showHelp() {
  console.log(`
${BOLD}Diverga Deploy${RESET} \u2014 One-command release pipeline

${BOLD}Usage:${RESET}
  node scripts/deploy.js patch           Patch release (X.Y.Z+1)
  node scripts/deploy.js minor           Minor release (X.Y+1.0)
  node scripts/deploy.js major           Major release (X+1.0.0)
  node scripts/deploy.js <X.Y.Z>         Explicit version
  node scripts/deploy.js patch --dry-run  Preview without changes
  node scripts/deploy.js --help           Show this help

${BOLD}Pipeline:${RESET}
  1. Pre-flight  \u2014 dev mode off, git clean, main branch
  2. Build       \u2014 generate, tsc, validate
  3. Version     \u2014 sync across all files
  4. Git         \u2014 commit, tag, push
  5. Release     \u2014 GitHub Release (release notes here only)
  6. Cache       \u2014 refresh plugin cache with allowlisted files
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const bump = args.find(a => !a.startsWith('-'));

if (!bump || bump === '--help' || bump === '-h') {
  showHelp();
  process.exit(bump ? 0 : 1);
}

const validBumps = ['patch', 'minor', 'major'];
if (!validBumps.includes(bump) && !/^\d+\.\d+\.\d+$/.test(bump)) {
  console.log(`\n${RED}Error:${RESET} Invalid bump "${bump}". Use patch, minor, major, or X.Y.Z\n`);
  process.exit(1);
}

console.log(`\n${BOLD}${CYAN}deploy${RESET}  ${dryRun ? `${YELLOW}(dry run)${RESET} ` : ''}Starting release pipeline...\n`);

preflight(dryRun);
buildAndValidate(dryRun);
const { oldVersion, newVersion } = bumpVersion(bump, dryRun);
gitCommitAndTag(newVersion, dryRun);
githubRelease(newVersion, dryRun);
refreshCache(newVersion, dryRun);

console.log(`\n${GREEN}${BOLD}Deploy complete!${RESET} v${oldVersion} \u2192 v${newVersion}`);
if (dryRun) console.log(`${YELLOW}(dry run \u2014 no changes were made)${RESET}`);
console.log('');
