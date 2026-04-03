// lib/filters.js — Job filtering and relevance scoring engine

'use strict';

// ── Experience → level mapping ────────────────────────────────────────────
const EXP_TO_LEVEL = [
  { maxYears: 1,  level: 'junior' },
  { maxYears: 2,  level: 'junior' },
  { maxYears: 4,  level: 'mid'    },
  { maxYears: 6,  level: 'senior' },
  { maxYears: 99, level: 'staff'  },
];

function yearsToLevel(years) {
  const y = parseInt(years, 10);
  if (isNaN(y)) return null;
  for (const { maxYears, level } of EXP_TO_LEVEL) {
    if (y <= maxYears) return level;
  }
  return 'staff';
}

const LEVEL_HIERARCHY = { junior: 0, mid: 1, senior: 2, staff: 3, any: -1 };

/**
 * Is a job level acceptable for the target user level?
 * "any" jobs are always shown.
 * A senior user can see mid+senior+staff, a junior sees junior only, etc.
 */
function levelMatches(jobLevel, targetLevel) {
  if (!targetLevel) return true;
  if (jobLevel === 'any') return true;
  const jl = LEVEL_HIERARCHY[jobLevel] ?? -1;
  const tl = LEVEL_HIERARCHY[targetLevel] ?? -1;
  if (tl === -1) return true;
  // Allow ±1 level (e.g. a mid candidate sees mid and senior jobs)
  return Math.abs(jl - tl) <= 1;
}

// ── Relevance scoring ─────────────────────────────────────────────────────
/**
 * Score a job against a user query.
 * Returns 0–100.
 */
function scoreRelevance(job, keywords) {
  if (!keywords || keywords.length === 0) return 50;

  const titleText = job.title.toLowerCase();
  const descText  = (job.description || '').toLowerCase();
  const tagsText  = (job.tags || []).join(' ').toLowerCase();
  const compText  = (job.company || '').toLowerCase();

  let score = 0;
  let totalWeight = 0;

  for (const kw of keywords) {
    const k = kw.toLowerCase();
    const titleHit = titleText.includes(k);
    const tagsHit  = tagsText.includes(k);
    const descHit  = descText.includes(k);
    const compHit  = compText.includes(k);

    // Title match = highest weight
    if (titleHit) score += 40;
    if (tagsHit)  score += 20;
    if (descHit)  score += 10;
    if (compHit)  score += 5;
    totalWeight += 40;
  }

  let normalized = totalWeight > 0 ? (score / totalWeight) * 100 : 50;

  // Bonus: job has salary info
  if (job.salary?.min) normalized += 5;

  // Bonus: posted in last 7 days
  const ageDays = (Date.now() - job.postedAt.getTime()) / 86_400_000;
  if (ageDays < 1)  normalized += 10;
  else if (ageDays < 3)  normalized += 5;
  else if (ageDays < 7)  normalized += 2;

  return Math.min(100, Math.round(normalized));
}

// ── Main filter function ──────────────────────────────────────────────────
/**
 * @param {object[]} jobs        — raw job list
 * @param {object}   opts
 * @param {string}   opts.keyword   — original user query string
 * @param {string}   opts.level     — target experience level ('junior'|'mid'|'senior'|'staff')
 * @param {number}   opts.exp       — years of experience (used if level not set)
 * @param {boolean}  opts.remote    — remote only
 * @param {number}   opts.minSalary — minimum annual salary (USD)
 * @param {string}   opts.location  — location substring filter
 * @param {string}   opts.type      — job type substring ('full-time','part-time','contract')
 */
function filterAndScore(jobs, opts = {}) {
  const {
    keyword   = '',
    level     = null,
    exp       = null,
    remote    = false,
    minSalary = 0,
    location  = '',
    type      = '',
  } = opts;

  const targetLevel  = level || yearsToLevel(exp);
  const keywords     = keyword.trim().split(/\s+/).filter(Boolean);
  const locLower     = location.toLowerCase();
  const typeLower    = type.toLowerCase();

  return jobs
    .filter((j) => {
      // Remote filter
      if (remote && !j.remote) return false;

      // Level filter
      if (targetLevel && !levelMatches(j.level, targetLevel)) return false;

      // Minimum salary filter
      if (minSalary > 0) {
        if (!j.salary?.min) return false;           // no salary info → skip
        if (j.salary.min < minSalary) return false;
      }

      // Location filter
      if (locLower) {
        const loc = (j.location || '').toLowerCase();
        if (!loc.includes(locLower) && loc !== 'remote' && loc !== 'worldwide') return false;
      }

      // Type filter
      if (typeLower) {
        const jtype = (j.type || '').toLowerCase();
        if (!jtype.includes(typeLower)) return false;
      }

      return true;
    })
    .map((j) => ({
      ...j,
      relevanceScore: scoreRelevance(j, keywords),
    }));
}

// ── Sort helpers ──────────────────────────────────────────────────────────
function sortJobs(jobs, sortBy = 'relevance') {
  const sorted = [...jobs];
  switch (sortBy) {
    case 'date':
      return sorted.sort((a, b) => b.postedAt - a.postedAt);
    case 'salary':
      return sorted.sort((a, b) => {
        const sa = a.salary?.min || 0;
        const sb = b.salary?.min || 0;
        return sb - sa;
      });
    case 'company':
      return sorted.sort((a, b) => a.company.localeCompare(b.company));
    case 'relevance':
    default:
      return sorted.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

// ── Dedup by title+company ─────────────────────────────────────────────────
function deduplicateJobs(jobs) {
  const seen = new Set();
  return jobs.filter((j) => {
    const key = `${j.title.toLowerCase().trim()}__${j.company.toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { filterAndScore, sortJobs, deduplicateJobs, yearsToLevel, levelMatches };
