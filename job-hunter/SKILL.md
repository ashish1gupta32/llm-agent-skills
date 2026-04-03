---
name: Job Hunter
description: >
  Searches for job postings across multiple free job boards (Remotive, RemoteOK,
  Jobicy, Arbeitnow), filters by experience level, salary, remote preference,
  and location, scores results by keyword relevance, and displays rich
  colour-coded job cards with company, salary, age, and apply links.
---

# Job Hunter Skill

A multi-source, relevance-ranked job board aggregator in your terminal. 

## Architecture

```
scripts/
  jobs.js              ← Entry point (command registry + CLI wrapper)
  lib/
    sources.js         ← Fetchers for 4 job boards + salary parser + level inference
    filters.js         ← Relevance scoring, experience→level mapping, dedup, sort
    renderer.js        ← ANSI colour terminal renderer with job cards
```

## Commands

### `search` — Find jobs matching your profile
```bash
node scripts/jobs.js search "frontend developer" --exp=2 --remote
node scripts/jobs.js search "backend engineer Node.js" --level=senior --min-salary=120000
node scripts/jobs.js search "data scientist python" --sort=salary
node scripts/jobs.js search "ML engineer" --source=remotive,remoteok --limit=20
node scripts/jobs.js search "devops kubernetes" --remote --location="Europe"
```

### `latest` — Most recently posted jobs
```bash
node scripts/jobs.js latest "react developer"
node scripts/jobs.js latest "golang" --remote --limit=10
```

### `salary` — Salary intelligence for a role
```bash
node scripts/jobs.js salary "senior react developer"
node scripts/jobs.js salary "machine learning engineer"
```

### `companies` — Most active hiring companies
```bash
node scripts/jobs.js companies "python"
node scripts/jobs.js companies "frontend" --limit=10
```

### `sources` — List supported job boards
```bash
node scripts/jobs.js sources
```

---

## Flags Reference

| Flag | Values | Default | Description |
|---|---|---|---|
| `--exp` | `0–15` | — | Years of experience (auto-maps to level) |
| `--level` | `junior\|mid\|senior\|staff` | — | Override level directly |
| `--remote` | (boolean) | off | Remote jobs only |
| `--min-salary` | number (USD) | 0 | Minimum annual salary |
| `--location` | string | — | Location substring filter |
| `--source` | CSV | `all` | `remotive,remoteok,jobicy,arbeitnow` |
| `--sort` | `relevance\|date\|salary\|company` | `relevance` | Sort order |
| `--limit` | number | `15` | Max results |
| `--no-desc` | (boolean) | off | Hide description snippets |

---

## Experience → Level Mapping

| Years | Mapped Level |
|---|---|
| 0–2 | Junior / Entry |
| 3–4 | Mid |
| 5–6 | Senior |
| 7+  | Staff / Lead |

---

## Supported Job Sources

| Board | Alias | Speciality |
|---|---|---|
| Remotive | `re` | Remote-first. Tech, design, marketing. |
| RemoteOK | `ro` | Developer-focused. Often has salary ranges. |
| Jobicy | `jc` | Global remote with level & industry data. |
| Arbeitnow | `an` | European & global. On-site + remote. |

> **Note on LinkedIn/Indeed:** These platforms require OAuth (paid API access) and 
> do not offer public job listing endpoints. The 4 sources above are fully free and 
> collectively list thousands of roles from companies that also post on LinkedIn/Indeed.

---

## How it works

### 1. Async fan-out
All sources are fetched concurrently with `Promise.allSettled` — if one board fails, others still return.

### 2. Salary parsing
Regex engine extracts structured salary from free-text: `$80k–$120k`, `$80,000`, `£50k`, `€60k/yr`.

### 3. Level inference
Scans title and tags for signals: "Senior", "Jr.", "Lead", "Intern", "Staff", etc.

### 4. Experience mapping
`--exp=3` → `mid` → jobs with level `junior`, `mid`, `senior` (±1 tolerance shown).

### 5. Relevance scoring
Keyword hits in title (+40pts), tags (+20pts), description (+10pts), company (+5pts),
plus freshness bonus (posted <24h = +10pts) and salary visibility bonus (+5pts).

### 6. Deduplication
Same title + same company across different boards → kept once.

## Requirements

- Node.js v18+
- No `npm install` needed
