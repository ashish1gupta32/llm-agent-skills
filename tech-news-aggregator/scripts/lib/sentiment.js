// lib/sentiment.js — Keyword-based sentiment scoring engine (no npm deps)

// ── Keyword lists ────────────────────────────────────────────────────────────

const POSITIVE = [
  // Product / tech launches
  'launch', 'launches', 'release', 'released', 'releasing', 'introducing',
  'announced', 'announcing', 'unveil', 'unveiled', 'debut',
  // Quality signals
  'new', 'open-source', 'open source', 'free', 'fast', 'faster', 'improved',
  'better', 'modern', 'efficient', 'scalable', 'powerful', 'innovative',
  'revolutionary', 'best', 'blazing', 'lightweight', 'secure', 'stable',
  // Community / positive reception
  'awesome', 'amazing', 'exciting', 'incredible', 'popular', 'trending',
  'breakthrough', 'milestone', 'achievement', 'winner', 'success',
  // Version / update signals
  'v2', 'v3', 'v4', 'upgrade', 'update', 'support', 'production', 'official',
  'feature', 'upgrade', 'enhancement', 'fix', 'patch',
];

const NEGATIVE = [
  // Security / safety
  'vulnerability', 'vulnerabilities', 'exploit', 'exploited', 'breach',
  'hack', 'hacked', 'hacking', 'attack', 'malware', 'ransomware',
  'leaked', 'leak', 'phishing', 'backdoor', 'zero-day', 'cve',
  // Failures
  'bug', 'bugs', 'broken', 'crash', 'crashed', 'outage', 'incident',
  'fail', 'failed', 'failure', 'error', 'problem', 'issue', 'warning',
  'critical', 'dangerous', 'unsafe', 'insecure',
  // End-of-life
  'deprecated', 'discontinue', 'discontinuing', 'discontinued', 'dead',
  'shutdown', 'banned', 'removed', 'deleted', 'sunsetting',
  // Performance / business
  'slow', 'bloated', 'layoff', 'layoffs', 'fired', 'lawsuit', 'fine',
  'banned', 'censored', 'monopoly',
];

// ── Sentiment engine ─────────────────────────────────────────────────────────

/**
 * Score a title's sentiment.
 * Returns a value in roughly [-1, +1] range.
 *   > +0.05  → POSITIVE 🟢
 *   < -0.05  → NEGATIVE 🔴
 *   otherwise → NEUTRAL  🟡
 */
function scoreSentiment(title) {
  const lower = title.toLowerCase();
  let raw = 0;
  let matches = [];

  for (const kw of POSITIVE) {
    if (lower.includes(kw)) {
      raw += 1;
      matches.push({ word: kw, polarity: '+' });
    }
  }
  for (const kw of NEGATIVE) {
    if (lower.includes(kw)) {
      raw -= 1;
      matches.push({ word: kw, polarity: '-' });
    }
  }

  const wordCount = title.split(/\s+/).length;
  const score = parseFloat((raw / Math.max(wordCount, 1)).toFixed(4));

  return { score, raw, matches };
}

/**
 * Derive an emoji label from a numeric score.
 */
function sentimentLabel(score) {
  if (score > 0.05) return '🟢';
  if (score < -0.05) return '🔴';
  return '🟡';
}

/**
 * Annotate each item with sentimentScore and sentimentLabel.
 */
function applySentiment(items) {
  return items.map((item) => {
    const { score } = scoreSentiment(item.title);
    return {
      ...item,
      sentimentScore: score,
      sentimentLabel: sentimentLabel(score),
    };
  });
}

/**
 * Sort items by sentiment score descending (most positive first).
 */
function sortBySentiment(items) {
  return [...items].sort((a, b) => b.sentimentScore - a.sentimentScore);
}

/**
 * Sort items by a weighted combined score: source popularity + sentiment bonus.
 */
function sortByTrending(items) {
  return [...items].sort((a, b) => {
    const scoreA = normalizeScore(a) + a.sentimentScore * 10;
    const scoreB = normalizeScore(b) + b.sentimentScore * 10;
    return scoreB - scoreA;
  });
}

/**
 * Normalize scores across sources (they use very different scales).
 * HN: can be 1-5000, Reddit: 1-100k, Dev.to: 1-1000
 */
function normalizeScore(item) {
  const caps = { hackernews: 3000, reddit: 50000, devto: 500 };
  const cap = caps[item.source] || 1000;
  return (Math.min(item.score, cap) / cap) * 100;
}

module.exports = {
  scoreSentiment,
  applySentiment,
  sortBySentiment,
  sortByTrending,
  sentimentLabel,
};
