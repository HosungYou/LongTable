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

import { existsSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync, lstatSync } from 'node:fs';
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
const PLUGIN_SYMLINK = join(PLUGINS_BASE, PLUGIN_NAME);
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
      console.log(`  ${GREEN}\u2713${RESET} ${item}`);
      linked++;
    } else {
      console.log(`  ${DIM}\u2298 ${item} (not found in source, skipped)${RESET}`);
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
        console.log(`  ${GREEN}\u2713${RESET} .claude/${subdir}`);
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
      console.log(`\n  ${GREEN}\u2713${RESET} installed_plugins.json updated (version: dev)`);
    }
  }

  // Step 6: Update plugin root symlink to point to source
  let previousSymlinkTarget = null;
  if (existsSync(PLUGIN_SYMLINK)) {
    try {
      previousSymlinkTarget = readlinkSync(PLUGIN_SYMLINK);
    } catch { /* not a symlink */ }
    rmSync(PLUGIN_SYMLINK, { force: true });
  }
  symlinkSync(ROOT, PLUGIN_SYMLINK);
  console.log(`  ${GREEN}✓${RESET} Plugin symlink → ${ROOT}`);

  // Step 7: Save dev state
  const state = {
    activatedAt: new Date().toISOString(),
    sourcePath: ROOT,
    devCachePath: devPath,
    backupPath: backupPath,
    originalVersion: currentVersion,
    linkedItems: linked,
    previousSymlinkTarget,
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
    console.log(`  ${GREEN}\u2713${RESET} Dev directory removed`);
  }

  // Step 2: Restore backup
  if (existsSync(backupPath)) {
    const restoredPath = join(CACHE_BASE, state.originalVersion);
    renameSync(backupPath, restoredPath);
    console.log(`  ${GREEN}\u2713${RESET} Cache restored from backup (v${state.originalVersion})`);
  } else {
    console.log(`  ${RED}Warning:${RESET} Backup not found at ${backupPath}`);
  }

  // Step 3: Restore plugin root symlink
  if (state.previousSymlinkTarget) {
    if (existsSync(PLUGIN_SYMLINK)) rmSync(PLUGIN_SYMLINK, { force: true });
    symlinkSync(state.previousSymlinkTarget, PLUGIN_SYMLINK);
    console.log(`  ${GREEN}✓${RESET} Plugin symlink → ${state.previousSymlinkTarget}`);
  }

  // Step 4: Restore installed_plugins.json
  //   Claude Code's /plugin update can overwrite our dev entry, removing _original* fields.
  //   Fall back to .dev-mode.json state + actual cache directory when that happens.
  if (existsSync(INSTALLED_PLUGINS_PATH)) {
    const plugins = readJSON(INSTALLED_PLUGINS_PATH);
    const key = `${PLUGIN_NAME}@${PLUGIN_NAME}`;
    if (plugins.plugins?.[key]?.[0]) {
      const entry = plugins.plugins[key][0];

      // Determine restore version: prefer _originalVersion, fall back to state, then find on disk
      let restoreVersion = entry._originalVersion || state.originalVersion;
      let restorePath = entry._originalInstallPath || join(CACHE_BASE, restoreVersion);

      // If the restored cache doesn't exist on disk, find the latest non-dev cache
      if (!existsSync(restorePath)) {
        const latest = findCurrentCacheVersion();
        if (latest) {
          restoreVersion = latest;
          restorePath = join(CACHE_BASE, latest);
        }
      }

      if (restoreVersion && existsSync(restorePath)) {
        entry.version = restoreVersion;
        entry.installPath = restorePath;
        delete entry._originalVersion;
        delete entry._originalInstallPath;
        entry.lastUpdated = new Date().toISOString();
        writeJSON(INSTALLED_PLUGINS_PATH, plugins);
        console.log(`  ${GREEN}\u2713${RESET} installed_plugins.json restored (version: ${entry.version})`);
      } else {
        console.log(`  ${YELLOW}Warning:${RESET} Could not determine restore version for installed_plugins.json`);
      }
    }
  }

  // Step 5: Remove state file
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
            console.log(`  ${YELLOW}\u26a0${RESET} ${item} is not a symlink`);
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
${BOLD}Diverga Dev Mode${RESET} \u2014 Selective symlink for plugin development

${BOLD}Usage:${RESET}
  node scripts/dev.js on       Activate dev mode (source \u2192 cache symlinks)
  node scripts/dev.js off      Deactivate (restore original cache backup)
  node scripts/dev.js status   Show current dev mode state
  node scripts/dev.js --help   Show this help

${BOLD}What it does:${RESET}
  Links allowlisted source paths into the plugin cache via symlinks.
  Source changes reflect immediately \u2014 no reinstall needed.

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
