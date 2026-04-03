---
name: Tech News Aggregator
description: >
  Fetches tech news from Hacker News, Dev.to, and Reddit simultaneously,
  deduplicates cross-source stories using trigram Jaccard similarity,
  scores each story's sentiment using a keyword engine, and outputs a
  ranked, colourised feed in the terminal — zero npm dependencies.
---

# Tech News Aggregator Skill

A multi-source, deduplicated, sentiment-ranked tech news feed in your terminal.

## Architecture

```
scripts/
  news.js              ← Entry point (command registry + CLI wrapper)
  lib/
    sources.js         ← Async fan-out fetchers (HN · Dev.to · Reddit)
    dedup.js           ← Trigram Jaccard deduplication engine
    sentiment.js       ← Keyword-based sentiment scorer & sorter
    renderer.js        ← ANSI colour terminal renderer
```

## Commands

### `feed` — Sentiment-ranked news feed
```bash
node scripts/news.js feed
node scripts/news.js feed --limit=15
node scripts/news.js feed --source=hn,devto
node scripts/news.js feed --sort=score
node scripts/news.js feed --sort=date --no-url
```

| Flag | Values | Default |
|---|---|---|
| `--limit` | any number | `20` |
| `--source` | `all` \| `hn` \| `devto` \| `rdt` \| comma-combined | `all` |
| `--sort` | `sentiment` \| `trending` \| `score` \| `date` | `sentiment` |
| `--no-url` | (boolean flag) | off |

---

### `trending` — Popularity + sentiment combined rank
```bash
node scripts/news.js trending
node scripts/news.js trending --limit=10 --source=hn
```

---

### `search` — Filter stories by keyword
```bash
node scripts/news.js search "rust"
node scripts/news.js search "AI" --source=devto --limit=10
node scripts/news.js search "security" --sort=date
```

---

### `dupes` — Debug: inspect near-duplicate pairs before dedup
```bash
node scripts/news.js dupes
node scripts/news.js dupes --threshold=0.4
```

---

### `sources` — List available sources and aliases
```bash
node scripts/news.js sources
```

---

## How it works

### 1. Fan-out fetch
All three sources are fetched concurrently via `Promise.allSettled`.
If one source fails (e.g., Reddit is rate-limiting), the others still succeed.
HN stories are fetched in batches of 10 to avoid overwhelming Firebase.

### 2. Deduplication (trigram Jaccard)
Every title is converted to a set of character trigrams (3-char substrings).
Two stories are considered duplicates if their Jaccard similarity ≥ 0.55.
When duplicates are found, the higher-scored story is kept.

```
"Python 3.13 released" vs "Python 3.13 is now out"
  trigrams A = {"pyt","yth","tho","hon",...}
  trigrams B = {"pyt","yth","tho","hon",...,"now","out"}
  Jaccard = |A∩B| / |A∪B| ≈ 0.72  → DUPLICATE, keep higher score
```

### 3. Sentiment scoring
Each title is matched against positive/negative keyword lists.
Raw score = (positive_hits - negative_hits) / word_count.
- 🟢 score > +0.05  → positive / exciting news
- 🔴 score < -0.05  → negative / warning news
- 🟡 otherwise       → neutral

### 4. Sorting modes
- `sentiment` — most positive/exciting first
- `trending`  — weighted: normalized_source_score + sentiment_bonus
- `score`     — raw upvote/reaction count descending
- `date`      — newest first

## Requirements

- Node.js v18+ (native `fetch`)
- No `npm install` needed
