# Dev Mode, Deploy Pipeline & Agent Teams Integration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add selective-symlink dev mode, one-command deploy pipeline, Agent Teams graceful integration, and documentation cleanup to Diverga.

**Architecture:** Dev mode uses allowlist-based symlinks from plugin cache to source, blocking all build artifacts and session data. Deploy pipeline wraps existing release.js with pre-flight checks, build validation, and cache refresh. Agent Teams integration adds contextual activation with graceful fallback to subagents.

**Tech Stack:** Node.js (ES modules), Claude Code plugin system, GitHub CLI (`gh`)

---

## Chunk 1: Dev Mode Script

### Task 1: Create `scripts/dev.js` — Core engine

**Files:**
- Create: `scripts/dev.js`

- [ ] **Step 1: Create dev.js with full implementation**

```javascript
#!/usr/bin/env node

/**
 * dev.js - Selective symlink dev mode for Diverga plugin development.
 *
 * Usage:
 *   node scripts/dev.js on       # Activate dev mode (symlink source → cache)
 *   node scripts/dev.js off      # Deactivate (restore original cache)
 *   node scripts/dev.js status   # Show current state
 *   node scripts/dev.js --help   # Show usage
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync, lstatSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
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

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PLUGIN_NAME = 'diverga';
const PLUGINS_BASE = join(process.env.HOME, '.claude', 'plugins');
const CACHE_BASE = join(PLUGINS_BASE, 'cache', PLUGIN_NAME, PLUGIN_NAME);
const INSTALLED_PLUGINS_PATH = join(PLUGINS_BASE, 'installed_plugins.json');
const DEV_STATE_FILE = join(ROOT, '.dev-mode.json');

// Allowlist: only these paths get symlinked
const ALLOWLIST = [
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
  '.mcp.json',
  'CLAUDE.md',
  'AGENTS.md',
  'package.json',
  'pyproject.toml',
];

// .claude/ special handling: only these subdirs
const CLAUDE_SUBDIR_ALLOWLIST = [
  'skills',
  'config',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function findCurrentCacheVersion() {
  if (!existsSync(CACHE_BASE)) return null;
  const entries = readdirSync(CACHE_BASE, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'dev' && !entry.name.endsWith('.bak')) {
      return entry.name;
    }
  }
  return null;
}

function isDevModeActive() {
  return existsSync(DEV_STATE_FILE);
}

function getDevState() {
  if (!isDevModeActive()) return null;
  return readJSON(DEV_STATE_FILE);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function activate() {
  if (isDevModeActive()) {
    const state = getDevState();
    console.log(`\n${YELLOW}Dev mode is already active${RESET} (since ${state.activatedAt})`);
    console.log(`Source: ${state.sourcePath}`);
    console.log(`Cache:  ${state.devCachePath}\n`);
    return;
  }

  const currentVersion = findCurrentCacheVersion();
  if (!currentVersion) {
    console.log(`\n${RED}Error:${RESET} No cache version found at ${CACHE_BASE}`);
    console.log('Is the Diverga plugin installed? Run: /plugin install diverga\n');
    process.exit(1);
  }

  const cachePath = join(CACHE_BASE, currentVersion);
  const backupPath = join(CACHE_BASE, `${currentVersion}.bak`);
  const devPath = join(CACHE_BASE, 'dev');

  console.log(`\n${BOLD}${CYAN}dev:on${RESET}  Activating dev mode...\n`);
  console.log(`  ${DIM}Source:${RESET}      ${ROOT}`);
  console.log(`  ${DIM}Cache:${RESET}       ${cachePath}`);
  console.log(`  ${DIM}Backup:${RESET}      ${backupPath}`);
  console.log(`  ${DIM}Dev path:${RESET}    ${devPath}`);
  console.log('');

  // Step 1: Backup current cache
  console.log(`  ${DIM}Backing up cache...${RESET}`);
  renameSync(cachePath, backupPath);

  // Step 2: Create dev directory
  mkdirSync(devPath, { recursive: true });

  // Step 3: Symlink allowlisted items
  let linked = 0;
  for (const item of ALLOWLIST) {
    const sourcePath = join(ROOT, item);
    const targetPath = join(devPath, item);
    if (existsSync(sourcePath)) {
      symlinkSync(sourcePath, targetPath);
      console.log(`  ${GREEN}✓${RESET} ${item}`);
      linked++;
    } else {
      console.log(`  ${DIM}⊘ ${item} (not found in source, skipped)${RESET}`);
    }
  }

  // Step 4: Handle .claude/ specially
  const claudeSourceDir = join(ROOT, '.claude');
  if (existsSync(claudeSourceDir)) {
    const claudeDevDir = join(devPath, '.claude');
    mkdirSync(claudeDevDir, { recursive: true });
    for (const subdir of CLAUDE_SUBDIR_ALLOWLIST) {
      const source = join(claudeSourceDir, subdir);
      const target = join(claudeDevDir, subdir);
      if (existsSync(source)) {
        symlinkSync(source, target);
        console.log(`  ${GREEN}✓${RESET} .claude/${subdir}`);
        linked++;
      }
    }
  }

  // Step 5: Update installed_plugins.json
  if (existsSync(INSTALLED_PLUGINS_PATH)) {
    const plugins = readJSON(INSTALLED_PLUGINS_PATH);
    const key = `${PLUGIN_NAME}@${PLUGIN_NAME}`;
    if (plugins.plugins?.[key]?.[0]) {
      const entry = plugins.plugins[key][0];
      entry._originalVersion = currentVersion;
      entry._originalInstallPath = entry.installPath;
      entry.version = 'dev';
      entry.installPath = devPath;
      entry.lastUpdated = new Date().toISOString();
      writeJSON(INSTALLED_PLUGINS_PATH, plugins);
      console.log(`\n  ${GREEN}✓${RESET} installed_plugins.json updated (version: dev)`);
    }
  }

  // Step 6: Save dev state
  const state = {
    activatedAt: new Date().toISOString(),
    sourcePath: ROOT,
    devCachePath: devPath,
    backupPath: backupPath,
    originalVersion: currentVersion,
    linkedItems: linked,
  };
  writeJSON(DEV_STATE_FILE, state);

  console.log(`\n${GREEN}${BOLD}Dev mode activated!${RESET} ${linked} items linked.`);
  console.log(`${DIM}Source changes now reflect immediately in the plugin cache.${RESET}`);
  console.log(`${DIM}Run \`node scripts/dev.js off\` to restore original cache.${RESET}\n`);
}

function deactivate() {
  if (!isDevModeActive()) {
    console.log(`\n${YELLOW}Dev mode is not active.${RESET}\n`);
    return;
  }

  const state = getDevState();
  const devPath = state.devCachePath;
  const backupPath = state.backupPath;

  console.log(`\n${BOLD}${CYAN}dev:off${RESET}  Deactivating dev mode...\n`);

  // Step 1: Remove dev directory (symlinks only, source is safe)
  if (existsSync(devPath)) {
    rmSync(devPath, { recursive: true, force: true });
    console.log(`  ${GREEN}✓${RESET} Dev directory removed`);
  }

  // Step 2: Restore backup
  if (existsSync(backupPath)) {
    const restoredPath = join(CACHE_BASE, state.originalVersion);
    renameSync(backupPath, restoredPath);
    console.log(`  ${GREEN}✓${RESET} Cache restored from backup (v${state.originalVersion})`);
  } else {
    console.log(`  ${RED}Warning:${RESET} Backup not found at ${backupPath}`);
  }

  // Step 3: Restore installed_plugins.json
  if (existsSync(INSTALLED_PLUGINS_PATH)) {
    const plugins = readJSON(INSTALLED_PLUGINS_PATH);
    const key = `${PLUGIN_NAME}@${PLUGIN_NAME}`;
    if (plugins.plugins?.[key]?.[0]) {
      const entry = plugins.plugins[key][0];
      if (entry._originalVersion) {
        entry.version = entry._originalVersion;
        entry.installPath = entry._originalInstallPath;
        delete entry._originalVersion;
        delete entry._originalInstallPath;
        entry.lastUpdated = new Date().toISOString();
        writeJSON(INSTALLED_PLUGINS_PATH, plugins);
        console.log(`  ${GREEN}✓${RESET} installed_plugins.json restored (version: ${entry.version})`);
      }
    }
  }

  // Step 4: Remove state file
  rmSync(DEV_STATE_FILE, { force: true });

  console.log(`\n${GREEN}${BOLD}Dev mode deactivated.${RESET} Original cache restored.\n`);
}

function status() {
  if (!isDevModeActive()) {
    const currentVersion = findCurrentCacheVersion();
    console.log(`\n${BOLD}Dev mode:${RESET} ${DIM}inactive${RESET}`);
    if (currentVersion) {
      console.log(`${BOLD}Cache version:${RESET} ${currentVersion}`);
      console.log(`${BOLD}Cache path:${RESET} ${join(CACHE_BASE, currentVersion)}`);
    }
    console.log('');
    return;
  }

  const state = getDevState();
  console.log(`\n${BOLD}Dev mode:${RESET} ${GREEN}active${RESET}`);
  console.log(`${BOLD}Activated:${RESET} ${state.activatedAt}`);
  console.log(`${BOLD}Source:${RESET} ${state.sourcePath}`);
  console.log(`${BOLD}Dev cache:${RESET} ${state.devCachePath}`);
  console.log(`${BOLD}Backup:${RESET} ${state.backupPath}`);
  console.log(`${BOLD}Linked items:${RESET} ${state.linkedItems}`);
  console.log(`${BOLD}Original version:${RESET} ${state.originalVersion}`);

  // Verify symlinks are intact
  let broken = 0;
  const devPath = state.devCachePath;
  if (existsSync(devPath)) {
    for (const item of ALLOWLIST) {
      const targetPath = join(devPath, item);
      if (existsSync(targetPath)) {
        try {
          const stat = lstatSync(targetPath);
          if (!stat.isSymbolicLink()) {
            console.log(`  ${YELLOW}⚠${RESET} ${item} is not a symlink`);
            broken++;
          }
        } catch { /* ignore */ }
      }
    }
  }

  if (broken > 0) {
    console.log(`\n${YELLOW}Warning:${RESET} ${broken} items are not symlinks. Run \`dev.js off && dev.js on\` to fix.`);
  }
  console.log('');
}

function showHelp() {
  console.log(`
${BOLD}Diverga Dev Mode${RESET} — Selective symlink for plugin development

${BOLD}Usage:${RESET}
  node scripts/dev.js on       Activate dev mode (source → cache symlinks)
  node scripts/dev.js off      Deactivate (restore original cache backup)
  node scripts/dev.js status   Show current dev mode state
  node scripts/dev.js --help   Show this help

${BOLD}What it does:${RESET}
  Links allowlisted source paths into the plugin cache via symlinks.
  Source changes reflect immediately — no reinstall needed.

${BOLD}Allowlist:${RESET}
  ${ALLOWLIST.join(', ')}
  .claude/skills, .claude/config

${BOLD}Blocked (never linked):${RESET}
  .git, node_modules, *.db, *.sqlite, .pytest_cache, __pycache__,
  .DS_Store, *.log, and everything not in the allowlist.
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const command = process.argv[2];

switch (command) {
  case 'on':
    activate();
    break;
  case 'off':
    deactivate();
    break;
  case 'status':
    status();
    break;
  case '--help':
  case '-h':
  case undefined:
    showHelp();
    break;
  default:
    console.log(`\n${RED}Unknown command:${RESET} ${command}`);
    showHelp();
    process.exit(1);
}
```

- [ ] **Step 2: Verify dev.js runs without errors**

Run: `node scripts/dev.js --help`
Expected: Help text with usage, allowlist, and blocked items.

- [ ] **Step 3: Test dev mode activation**

Run: `node scripts/dev.js on`
Expected: Symlinks created, backup made, installed_plugins.json updated with version "dev".

- [ ] **Step 4: Test dev mode status**

Run: `node scripts/dev.js status`
Expected: Shows "active", source path, linked items count.

- [ ] **Step 5: Test dev mode deactivation**

Run: `node scripts/dev.js off`
Expected: Symlinks removed, backup restored, installed_plugins.json restored.

- [ ] **Step 6: Commit**

```bash
git add scripts/dev.js
git commit -m "feat: add selective symlink dev mode (scripts/dev.js)"
```

---

## Chunk 2: Deploy Pipeline

### Task 2: Create `scripts/deploy.js`

**Files:**
- Create: `scripts/deploy.js`

- [ ] **Step 1: Create deploy.js**

```javascript
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

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, cpSync, readdirSync } from 'node:fs';
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
      console.log(`  ${YELLOW}⚠${RESET} Dev mode is active (would deactivate)`);
    } else {
      console.log(`  ${YELLOW}⚠${RESET} Dev mode active — deactivating...`);
      run('node scripts/dev.js off');
    }
  } else {
    console.log(`  ${GREEN}✓${RESET} Dev mode inactive`);
  }

  // Check git clean
  const status = runSilent('git status --porcelain');
  if (status.length > 0) {
    console.log(`  ${RED}✗${RESET} Working tree not clean:`);
    console.log(status);
    if (!dryRun) process.exit(1);
  } else {
    console.log(`  ${GREEN}✓${RESET} Working tree clean`);
  }

  // Check branch
  const branch = runSilent('git rev-parse --abbrev-ref HEAD');
  if (branch !== 'main') {
    console.log(`  ${YELLOW}⚠${RESET} Not on main branch (current: ${branch})`);
  } else {
    console.log(`  ${GREEN}✓${RESET} On main branch`);
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
    console.log(`  ${GREEN}✓${RESET} Version synced across all files`);
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
  console.log(`  ${GREEN}✓${RESET} Pushed v${newVersion} with tag`);
}

function githubRelease(newVersion, dryRun) {
  console.log(`\n${BOLD}[5/6] GitHub Release${RESET}\n`);

  if (dryRun) {
    console.log(`  ${DIM}(dry run: would create GitHub release for v${newVersion})${RESET}`);
    return;
  }

  try {
    run(`gh release create v${newVersion} --generate-notes`);
    console.log(`  ${GREEN}✓${RESET} GitHub release created`);
  } catch {
    console.log(`  ${YELLOW}⚠${RESET} GitHub release failed (create manually if needed)`);
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

    try {
      const stat = require('node:fs').statSync(sourcePath);
      if (stat.isDirectory()) {
        copyFiltered(sourcePath, targetPath);
      } else {
        cpSync(sourcePath, targetPath);
      }
    } catch {
      cpSync(sourcePath, targetPath, { recursive: true });
    }
  }

  console.log(`  ${GREEN}✓${RESET} Cache populated at ${newCachePath}`);

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
      console.log(`  ${GREEN}✓${RESET} installed_plugins.json updated`);
    }
  }
}

function showHelp() {
  console.log(`
${BOLD}Diverga Deploy${RESET} — One-command release pipeline

${BOLD}Usage:${RESET}
  node scripts/deploy.js patch           Patch release (X.Y.Z+1)
  node scripts/deploy.js minor           Minor release (X.Y+1.0)
  node scripts/deploy.js major           Major release (X+1.0.0)
  node scripts/deploy.js <X.Y.Z>         Explicit version
  node scripts/deploy.js patch --dry-run  Preview without changes
  node scripts/deploy.js --help           Show this help

${BOLD}Pipeline:${RESET}
  1. Pre-flight  — dev mode off, git clean, main branch
  2. Build       — generate, tsc, validate
  3. Version     — sync across all files
  4. Git         — commit, tag, push
  5. Release     — GitHub Release (release notes here only)
  6. Cache       — refresh plugin cache with allowlisted files
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

console.log(`\n${GREEN}${BOLD}Deploy complete!${RESET} v${oldVersion} → v${newVersion}`);
if (dryRun) console.log(`${YELLOW}(dry run — no changes were made)${RESET}`);
console.log('');
```

- [ ] **Step 2: Fix deploy.js `statSync` import (uses `import` not `require`)**

Replace the `require('node:fs').statSync` call in `refreshCache` with the already-imported `lstatSync` or add `statSync` to the import:

Change the import line to include `statSync`:
```javascript
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, cpSync, statSync } from 'node:fs';
```

And replace the try/catch block in `refreshCache`:
```javascript
    if (statSync(sourcePath).isDirectory()) {
      copyFiltered(sourcePath, targetPath);
    } else {
      cpSync(sourcePath, targetPath);
    }
```

- [ ] **Step 3: Verify deploy.js runs**

Run: `node scripts/deploy.js --help`
Expected: Help text with pipeline stages listed.

- [ ] **Step 4: Test dry run**

Run: `node scripts/deploy.js patch --dry-run`
Expected: All 6 stages shown with "(dry run)" placeholders, no changes made.

- [ ] **Step 5: Commit**

```bash
git add scripts/deploy.js
git commit -m "feat: add one-command deploy pipeline (scripts/deploy.js)"
```

---

### Task 3: Add npm scripts to package.json

**Files:**
- Modify: `package.json` (scripts section)

- [ ] **Step 1: Add dev and deploy scripts**

Add these to `package.json` `scripts` section:
```json
"dev": "node scripts/dev.js",
"dev:on": "node scripts/dev.js on",
"dev:off": "node scripts/dev.js off",
"dev:status": "node scripts/dev.js status",
"deploy": "node scripts/deploy.js"
```

- [ ] **Step 2: Verify scripts work**

Run: `npm run dev -- --help`
Run: `npm run deploy -- --help`
Expected: Both show help text.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add dev/deploy npm scripts"
```

---

## Chunk 3: Agent Teams Integration

### Task 4: Update `config/diverga-config.json` schema

**Files:**
- Modify: `config/diverga-config.json`

- [ ] **Step 1: Add agent_teams config block**

Add to `diverga-config.json`:
```json
"agent_teams": {
  "enabled": false,
  "auto_activate": true,
  "scenarios": ["vs_arena", "systematic_review", "humanize_pipeline", "cross_method"]
}
```

`enabled` tracks whether the user has opted in via setup.
`auto_activate` means Diverga contextually decides when to use teams.
`scenarios` lists which workflows can use Agent Teams.

- [ ] **Step 2: Commit**

```bash
git add config/diverga-config.json
git commit -m "feat: add agent_teams config block"
```

### Task 5: Update setup wizard with Agent Teams step

**Files:**
- Modify: `skills/setup/SKILL.md`

- [ ] **Step 1: Add Step 5 (Agent Teams) between current Step 4 (VS Arena) and Step 5 (Generate Config)**

Insert after the VS Arena section, before "Generate Configuration & Complete":

```markdown
### Step 5: Agent Teams (Experimental)

Check if `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is already set:
- If already `1` → display "Agent Teams: already enabled ✓" and skip question
- Otherwise → ask:

\```
question: "Enable Agent Teams for multi-agent collaboration?"
header: "Agent Teams (Experimental)"
options:
  - label: "Enable (Recommended with VS Arena)"
    description: "Agents debate and collaborate directly. Requires more tokens but enables deeper analysis."
  - label: "Skip"
    description: "Agents work independently via coordinator. Lower cost, still effective."
\```

**If Enable selected:**
1. Write to `~/.claude/settings.json`:
   ```json
   { "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
   ```
   (merge with existing settings, don't overwrite)
2. Add to `config/diverga-config.json`:
   ```json
   { "agent_teams": { "enabled": true, "auto_activate": true } }
   ```
3. If VS Arena was also enabled, note: "Agent Teams + VS Arena will enable direct inter-persona debates."

**If Skip selected:**
- Add to config: `{ "agent_teams": { "enabled": false } }`
- Note: "You can enable Agent Teams later by running /diverga:setup again."
```

Renumber existing Step 5 to Step 6.

- [ ] **Step 2: Update setup description and completion banner**

Update frontmatter description:
```yaml
description: |
  Diverga v11.2 configuration wizard. 5-step setup.
  Sets up checkpoints, OpenAlex email, HUD, VS Arena, and Agent Teams.
  Triggers: setup, configure, 설정, install
```

Update completion banner to include Agent Teams info:
```
║  New in v11.2:                                                   ║
║  • Agent Teams — multi-agent direct collaboration (optional)     ║
║  • Dev mode — selective symlink for plugin development           ║
║  • One-command deploy pipeline                                   ║
```

- [ ] **Step 3: Commit**

```bash
git add skills/setup/SKILL.md
git commit -m "feat: add Agent Teams step to setup wizard"
```

### Task 6: Update research-orchestrator for Agent Teams graceful degradation

**Files:**
- Modify: `skills/research-orchestrator/SKILL.md`

- [ ] **Step 1: Expand Agent Teams dispatch section**

Replace the existing "Agent Teams Dispatch (v8.5)" section with:

```markdown
### Agent Teams Dispatch (v11.2)

When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set AND `config.agent_teams.enabled` is true,
the orchestrator contextually decides whether to use Agent Teams or subagents.

#### Decision Logic

```
Task received → Check agent_teams config
  ├── enabled: false → Always use subagents (existing behavior)
  └── enabled: true → Evaluate scenario
      ├── VS Arena (V1-V5 debate) → Teams mode
      │   TeamCreate("vs-arena-debate")
      │   3 persona teammates with SendMessage cross-critique
      ├── Systematic Review (I0 pipeline) → Teams mode
      │   TeamCreate("scholarag-pipeline")
      │   I1 fetchers + I2 screener + I3 RAG builder in parallel
      ├── Humanize Pipeline (G5→G6→F5) → Teams mode
      │   TeamCreate("humanize-pipeline")
      │   G6 ↔ F5 direct verification loop
      ├── Cross-Method (C1+C2+C3) → Teams mode
      │   TeamCreate("method-comparison")
      │   Competing design recommendations with mutual challenge
      └── All other workflows → Subagents (existing behavior)
```

#### Graceful Fallback

If Agent Teams are unavailable (env var not set or feature disabled):
- All workflows fall back to existing subagent dispatch
- No code changes needed — same skill files, different execution path
- Orchestrator logs: "Agent Teams unavailable, using subagent mode"

#### Token Cost Awareness

Agent Teams use significantly more tokens. The orchestrator should:
- Prefer subagents for simple sequential tasks
- Only activate teams when parallel exploration or inter-agent debate adds value
- Maximum 3-5 teammates per team (per Claude Code best practices)
```

- [ ] **Step 2: Commit**

```bash
git add skills/research-orchestrator/SKILL.md
git commit -m "feat: expand Agent Teams dispatch with graceful degradation"
```

### Task 7: Update VS Arena skill for Agent Teams mode

**Files:**
- Modify: `skills/vs-arena/SKILL.md`

- [ ] **Step 1: Add Agent Teams execution path**

Add a section to vs-arena SKILL.md that describes the teams-based flow:

```markdown
## Agent Teams Mode (when available)

When Agent Teams is enabled, VS Arena uses direct inter-persona debate:

### Teams Flow
1. Orchestrator creates team: `TeamCreate("vs-arena-debate")`
2. Spawn 3 persona teammates (selected V1-V5 based on research question)
3. Each persona independently analyzes the research question
4. Cross-critique round: each persona challenges the others via `SendMessage`
5. Personas refine their recommendations based on feedback
6. Lead synthesizes all positions at CP_METHODOLOGY_APPROVAL
7. Present to user with full debate transcript

### Subagent Flow (fallback)
(existing behavior — coordinator mediates all exchange)

The skill file works identically in both modes. The orchestrator decides
which execution path to use based on environment and config.
```

- [ ] **Step 2: Commit**

```bash
git add skills/vs-arena/SKILL.md
git commit -m "feat: add Agent Teams execution path to VS Arena"
```

---

## Chunk 4: Documentation & Cleanup

### Task 8: Update CLAUDE.md with Development section

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Development section before the closing ---**

Add at the end of CLAUDE.md, before `Developer notes: docs/DEVELOPER.md`:

```markdown
---

## Development

### Dev Mode (Auto-Managed)

When working in this directory, Claude should automatically:
1. Check dev mode status (`node scripts/dev.js status`)
2. Activate if inactive (`node scripts/dev.js on`)
3. Proceed with work

Manual override: `npm run dev:on` / `npm run dev:off` / `npm run dev:status`

Dev mode links only allowlisted paths (agents/, skills/, mcp/, hooks/, config/,
dist/, src/, lib/, docs/, .claude-plugin/, .claude/skills, .claude/config,
.mcp.json, CLAUDE.md, AGENTS.md, package.json, pyproject.toml) and blocks all
build artifacts, caches, databases, and session data from leaking into the
plugin cache.

### Deploy

One-command release pipeline: `npm run deploy patch|minor|major`

Pipeline: dev off → generate → build → validate → version sync → git commit/tag/push → GitHub Release → cache refresh

Dry run: `npm run deploy -- patch --dry-run`

### Agent Teams

When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set and enabled in config,
the orchestrator contextually activates Agent Teams for scenarios that benefit
from inter-agent collaboration (VS Arena debates, systematic review pipeline,
humanization pipeline, cross-method comparison). Falls back to subagents
automatically when unavailable.

Enable via `/diverga:setup` or set manually in `~/.claude/settings.json`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Development section to CLAUDE.md"
```

### Task 9: Update docs/DEVELOPER.md

**Files:**
- Modify: `docs/DEVELOPER.md`

- [ ] **Step 1: Add dev mode and deploy sections**

Append to `docs/DEVELOPER.md`:

```markdown
---

## Dev Mode

### Architecture

Dev mode creates selective symlinks from the plugin source to the cache directory.
Only allowlisted paths are linked — all build artifacts, session data, and databases
are automatically blocked.

```
Source (Diverga-core/)
  ├── agents/     ─── symlink ──→  cache/diverga/diverga/dev/agents/
  ├── skills/     ─── symlink ──→  cache/diverga/diverga/dev/skills/
  ├── ...         ─── symlink ──→  ...
  ├── node_modules/  (blocked)
  ├── .git/          (blocked)
  └── *.db           (blocked)
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev:on` | Activate (backup cache, create symlinks, update installed_plugins.json) |
| `npm run dev:off` | Deactivate (remove symlinks, restore backup) |
| `npm run dev:status` | Show current state with symlink health check |

### State File

`.dev-mode.json` (gitignored) tracks activation state:
- `activatedAt`: timestamp
- `sourcePath`: source directory
- `devCachePath`: symlink target directory
- `backupPath`: original cache backup
- `originalVersion`: version before dev mode

### Troubleshooting

| Problem | Solution |
|---------|----------|
| "No cache version found" | Plugin not installed. Run `/plugin install diverga` |
| Broken symlinks | Run `npm run dev:off && npm run dev:on` |
| installed_plugins.json corrupted | Run `npm run dev:off`, manually check the JSON |

---

## Deploy Pipeline

### Commands

| Command | Description |
|---------|-------------|
| `npm run deploy -- patch` | Patch release (X.Y.Z → X.Y.Z+1) |
| `npm run deploy -- minor` | Minor release |
| `npm run deploy -- major` | Major release |
| `npm run deploy -- patch --dry-run` | Preview without changes |

### Pipeline Stages

1. **Pre-flight**: Dev mode off, git clean, main branch check
2. **Build & validate**: generate, tsc, version check
3. **Version bump**: sync across all 38+ files
4. **Git**: commit, tag, push
5. **GitHub Release**: `gh release create` with auto-generated notes
6. **Cache refresh**: clean old cache, copy allowlisted files, update installed_plugins.json

### Release Notes

Release notes go to GitHub Releases ONLY (https://github.com/HosungYou/Diverga/releases).
They are NOT stored as files in the repository. Written in English.

---

## Agent Teams Integration

### Configuration

`config/diverga-config.json`:
```json
{
  "agent_teams": {
    "enabled": false,
    "auto_activate": true,
    "scenarios": ["vs_arena", "systematic_review", "humanize_pipeline", "cross_method"]
  }
}
```

### Enable

1. Via setup wizard: `/diverga:setup` (Step 5)
2. Manual: set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `~/.claude/settings.json`

### Scenarios

| Scenario | Team Name | Teammates | Benefit |
|----------|-----------|-----------|---------|
| VS Arena | vs-arena-debate | 3 personas (V1-V5) | Direct cross-critique |
| Systematic Review | scholarag-pipeline | I1+I2+I3 | Parallel fetch/screen/RAG |
| Humanize | humanize-pipeline | G6+F5 | Direct verification loop |
| Cross-Method | method-comparison | C1+C2+C3 | Competing designs |
```

- [ ] **Step 2: Commit**

```bash
git add docs/DEVELOPER.md
git commit -m "docs: add dev mode, deploy, and Agent Teams to DEVELOPER.md"
```

### Task 10: Update CONTRIBUTING.md

**Files:**
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Update Development Setup section**

Replace the existing "Development Setup" section with updated instructions that include dev mode:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: update CONTRIBUTING.md with dev mode and deploy workflow"
```

### Task 11: Remove duplicate docs/CHANGELOG.md

**Files:**
- Delete: `docs/CHANGELOG.md`

- [ ] **Step 1: Verify it's a duplicate/subset of root CHANGELOG.md**

Compare: root CHANGELOG.md (85KB, 2039 lines) vs docs/CHANGELOG.md (14KB).
The docs version is an older subset.

- [ ] **Step 2: Delete docs/CHANGELOG.md**

```bash
git rm docs/CHANGELOG.md
```

- [ ] **Step 3: Update any references to docs/CHANGELOG.md**

In `docs/DEVELOPER.md` line 122: change `docs/CHANGELOG.md` → `CHANGELOG.md`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove duplicate docs/CHANGELOG.md, consolidate to root"
```

### Task 12: Add .dev-mode.json to .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add dev mode state file to .gitignore**

Add line: `.dev-mode.json`

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .dev-mode.json to .gitignore"
```

---

## Chunk 5: Version Bump, Deploy & Release

### Task 13: Run deploy pipeline

- [ ] **Step 1: Verify all changes are committed**

Run: `git status`
Expected: Clean working tree.

- [ ] **Step 2: Run deploy with minor version bump**

This is a feature release (dev mode, deploy pipeline, Agent Teams integration).

Run: `node scripts/deploy.js minor`

Expected pipeline:
1. Pre-flight: clean, main branch ✓
2. Build: generate, tsc, validate ✓
3. Version: 11.1.1 → 11.2.0 (sync all files)
4. Git: commit, tag v11.2.0, push
5. GitHub Release: auto-generated notes
6. Cache: refresh with new version

- [ ] **Step 3: Verify deployment**

Run: `node scripts/dev.js status`
Expected: Shows cache version 11.2.0, dev mode inactive.

Check: `cat ~/.claude/plugins/installed_plugins.json | grep -A5 diverga`
Expected: version "11.2.0", updated installPath and gitCommitSha.

- [ ] **Step 4: Activate dev mode for continued development**

Run: `node scripts/dev.js on`
Expected: Dev mode active, source linked to cache.
