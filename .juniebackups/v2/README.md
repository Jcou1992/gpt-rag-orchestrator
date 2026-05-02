# .juniebackups — Old Junie Skill Files

This folder contains backup copies of Junie skill documentation files that were reorganized.

## What happened

On 2026-04-14, the Junie skill documentation was reorganized for clarity:

**Before:** All guides lived in `.junie/` root alongside playbooks.
```
.junie/
├── guidelines.md
├── SKILL_USAGE.md          ← moved to guides/
├── QUICK_START.md          ← moved to guides/
├── NAVIGATION.md           ← moved to guides/
├── REFACTORING_SUMMARY.md  ← moved to guides/
├── playbooks/
└── guides/
```

**After:** Guides moved to `.junie/guides/` for clarity.
```
.junie/
├── guidelines.md
├── playbooks/
└── guides/
    ├── SKILL_USAGE.md
    ├── QUICK_START.md
    ├── NAVIGATION.md
    └── REFACTORING_SUMMARY.md
```

## Files in this backup

- **NAVIGATION.md** — Outdated. Use `../junie/guides/NAVIGATION.md` instead.
- **QUICK_START.md** — Outdated. Use `../junie/guides/QUICK_START.md` instead.
- **SKILL_USAGE.md** — Outdated. Use `../junie/guides/SKILL_USAGE.md` instead.
- **REFACTORING_SUMMARY.md** — Outdated. Use `../junie/guides/REFACTORING_SUMMARY.md` instead.

## Why keep these backups?

Safety. In case someone had old links or references to these files. They're preserved here for 30 days, then can be safely deleted.

## To use the skill

Read from **`.junie/guides/`** instead:

```bash
# Start here if confused
.junie/guides/NAVIGATION.md

# Real scenario walkthrough (first time users)
.junie/guides/QUICK_START.md

# Complete reference
.junie/guides/SKILL_USAGE.md

# Design rationale
.junie/guides/REFACTORING_SUMMARY.md
```

## Safe to delete after

30 days (around 2026-05-14), these backups can be safely deleted. They're just old versions.
