# LongTable 0.1.16 Release Record

## Outcome

LongTable `0.1.16` was published to npm and deployed to GitHub on
2026-04-21.

- GitHub PR: <https://github.com/HosungYou/LongTable/pull/2>
- GitHub Release: <https://github.com/HosungYou/LongTable/releases/tag/v0.1.16>
- npm latest: `@longtable/cli@0.1.16`
- merge commit: `ebedc1336e671b47f88ba5c6bce33ba24a2040a5`

## What Shipped

- permission-first `longtable setup`
- lightweight `longtable sentinel`
- `longtable hud`
- tmux-backed `longtable team`
- package version alignment to `0.1.16`
- documented npm WebAuthn/security-key publish flow

## Verification

Local verification:

```bash
npm ci
npm run test
npm run pack:check
npm install -g @longtable/cli@0.1.16
longtable sentinel --prompt "Should I use an established measurement scale before defining a new construct?" --json
longtable team --prompt "Review LongTable setup as a research harness" --role editor,measurement_auditor --json
```

Remote verification:

```bash
gh pr view 2 --json state,mergedAt,mergeCommit,statusCheckRollup
gh release view v0.1.16 --json url,tagName,name,publishedAt,isDraft,isPrerelease,targetCommitish
npm view @longtable/cli version dist-tags --json
```

## Authentication Note

The `newhosung` npm account uses npm WebAuthn/security-key authentication for
write actions. During manual publish, npm may return `EOTP` and print an
`npm.com/auth/cli` URL rather than accepting an authenticator-app OTP.

The working path was:

1. run the first `npm publish --workspace ...` command in a TTY
2. press Enter when npm asks to open the browser
3. complete npm security-key/passkey authentication in the browser
4. continue publishing the remaining workspaces in dependency order

Do not ask for npm passwords, recovery codes, or long-lived tokens in chat.

## CI Incident

The first PR CI run failed in `npm ci` with `EINTEGRITY`. The lockfile contained
`@longtable/*@0.1.16` integrity values generated before the final published
tarballs existed. The registry had the correct tarballs, but
`package-lock.json` pointed at stale integrity hashes.

Resolution:

- read each published package's `dist.integrity` from npm
- updated every `package-lock.json` entry for published `@longtable/*@0.1.16`
- reran `npm ci`, `npm run test`, and `npm run pack:check`
- pushed `a1c4f6a Refresh published package lock integrity`
- confirmed CI `verify` passed before merging

## Follow-Up

- Consider replacing the repo `NPM_TOKEN` secret with a current npm granular
  token or trusted publishing configuration.
- Consider adding a release check that compares lockfile registry integrity
  values against `npm view` after manual publishes.
- GitHub Actions emitted a Node.js 20 action deprecation warning for the actions
  used by the workflows. This did not block `0.1.16`, but should be tracked as
  workflow maintenance before the 2026 runner transition.
