# GitHub Setup

## Recommendation

Create a separate private GitHub repository for this refactoring workspace.

Recommended names:

- `LongTable-Refactoring`
- `LongTable`
- `LongTable-Harness`

Preferred default: `LongTable-Refactoring`

## Visibility

Start with `private`.

Reason:

- the contracts are still changing
- package boundaries are not stable yet
- the repository currently contains architecture material rather than release-ready runtime code

## Suggested Description

`Architecture and refactoring workspace for the next-generation LongTable researcher-centered harness.`

## Local-First Sequence

1. initialize local git
2. validate repository bootstrap documents
3. re-authenticate GitHub CLI
4. create a private remote repository
5. add remote and push the initial branch

## Suggested Commands

```bash
gh auth login -h github.com
gh repo create HosungYou/LongTable-Refactoring --private --source="/Volumes/External SSD/Projects/LongTable/LongTable-Refactoring" --remote=origin --push
```

If the repository should be created first without push:

```bash
gh repo create HosungYou/LongTable-Refactoring --private --description "Architecture and refactoring workspace for the next-generation LongTable researcher-centered harness."
git -C "/Volumes/External SSD/Projects/LongTable/LongTable-Refactoring" remote add origin git@github.com:HosungYou/LongTable-Refactoring.git
```

## Branch Policy

- keep `main` as the only default branch during early architecture work
- create focused branches only when implementation starts
- do not mirror the full production LongTable repository history into this workspace

## Relationship Policy

Keep this repository linked conceptually to `LongTable`, but do not treat it as a fork unless the migration strategy later requires that history.
