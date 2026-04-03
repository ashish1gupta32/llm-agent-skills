// lib/renderer.js — ANSI coloured terminal renderer for job listings

'use strict';

// ── ANSI codes ────────────────────────────────────────────────────────────
const C = {
  reset:   '\x1b[0m',  bold:    '\x1b[1m',  dim:     '\x1b[2m',
  red:     '\x1b[31m', green:   '\x1b[32m', yellow:  '\x1b[33m',
  blue:    '\x1b[34m', magenta: '\x1b[35m', cyan:    '\x1b[36m',
  white:   '\x1b[37m', gray:    '\x1b[90m',
  bgGreen: '\x1b[42m', bgBlue:  '\x1b[44m',
  brightGreen:  '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightCyan:   '\x1b[96m',
};

const SOURCE_STYLE = {
  remotive:  { color: C.cyan,          badge: ' REMOTIVE  ', icon: '🌐' },
  remoteok:  { color: C.green,         badge: ' REMOTE OK ', icon: '✅' },
  jobicy:    { color: C.magenta,       badge: ' JOBICY    ', icon: '🟣' },
  arbeitnow: { color: C.yellow,        badge: ' ARBEITNOW ', icon: '🔶' },
  instahyre: { color: C.brightGreen,   badge: ' INSTAHYRE ', icon: '🇻🇳' },
  leetcode:  { color: C.brightYellow,  badge: ' LEETCODE  ', icon: '💬' },
};

const LEVEL_STYLE = {
  junior: { color: C.green,   label: '  JUNIOR  ' },
  mid:    { color: C.cyan,    label: '   MID    ' },
  senior: { color: C.yellow,  label: '  SENIOR  ' },
  staff:  { color: C.magenta, label: '  STAFF   ' },
  any:    { color: C.gray,    label: '  ANY LVL ' },
};

// ── Helpers ───────────────────────────────────────────────────────────────
const p     = (col, t) => `${col}${t}${C.reset}`;
const bold  = (t) => `${C.bold}${t}${C.reset}`;
const dim   = (t) => `${C.dim}${t}${C.reset}`;
const gray  = (t) => p(C.gray, t);
const green = (t) => p(C.green, t);
const red   = (t) => p(C.red, t);
const cyan  = (t) => p(C.cyan, t);

function ruler(char = '─', w = 72) { return gray(char.repeat(w)); }

function trunc(s, max) { return s.length > max ? s.slice(0, max - 3) + '…' : s; }

function formatAge(date) {
  if (!date || isNaN(date.getTime())) return 'unknown';
  const m = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

function ageColor(date) {
  const h = Math.floor((Date.now() - date.getTime()) / 3_600_000);
  if (h < 24)  return C.brightGreen;
  if (h < 72)  return C.green;
  if (h < 168) return C.yellow;
  return C.gray;
}

function salaryBar(salary, { formatSalary }) {
  const fmt = formatSalary(salary);
  if (!fmt) return gray('💰 Salary not disclosed');
  return `${p(C.brightGreen, '💰')} ${bold(p(C.brightGreen, fmt))}`;
}

function relevanceBar(score) {
  const filled = Math.round(score / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  const col = score >= 80 ? C.green : score >= 50 ? C.yellow : C.gray;
  return `${p(col, bar)} ${dim(score + '%')}`;
}

// ── Single job card ───────────────────────────────────────────────────────
function renderJobCard(job, idx, { showDesc = true, formatSalary } = {}) {
  const src   = SOURCE_STYLE[job.source] || { color: C.white, badge: ' SOURCE    ' };
  const lvl   = LEVEL_STYLE[job.level]  || LEVEL_STYLE.any;
  const num   = dim(String(idx + 1).padStart(3) + '.');

  // ── Line 1: number + title ─────────────────────────────────────────────
  console.log(`${num}  ${bold(trunc(job.title, 65))}`);

  // ── Line 2: company + location + remote badge ──────────────────────────
  const remoteBadge = job.remote
    ? p(C.brightCyan, '  REMOTE  ')
    : p(C.gray, ' ON-SITE  ');
  const loc = trunc(job.location || 'Unknown', 30);
  console.log(
    `      ${bold(p(C.brightYellow, job.company || 'Unknown Company'))}  ` +
    `${gray('📍')} ${dim(loc)}  ${remoteBadge}`
  );

  // ── Line 3: source badge + level + posted age ──────────────────────────
  const srcBadge   = `${src.color}${C.bold}${src.badge}${C.reset}`;
  const levelBadge = `${lvl.color}${C.bold}${lvl.label}${C.reset}`;
  const age        = `${p(ageColor(job.postedAt), '🕐')} ${p(ageColor(job.postedAt), formatAge(job.postedAt))}`;
  console.log(`      ${srcBadge}  ${levelBadge}  ${age}`);

  // ── Line 4: salary ─────────────────────────────────────────────────────
  console.log(`      ${salaryBar(job.salary, { formatSalary })}`);

  // ── Line 5: tags ───────────────────────────────────────────────────────
  if (job.tags?.length > 0) {
    const tags = job.tags.slice(0, 6).map((t) => gray(`#${t}`)).join('  ');
    console.log(`      ${tags}`);
  }

  // ── Line 6: relevance bar ──────────────────────────────────────────────
  if (job.relevanceScore != null) {
    console.log(`      ${dim('Match:')} ${relevanceBar(job.relevanceScore)}`);
  }

  // ── Line 7: description snippet ───────────────────────────────────────
  if (showDesc && job.description) {
    console.log(`      ${dim(trunc(job.description, 120))}`);
  }

  // ── Line 8: apply URL (never truncate — must stay clickable) ──────────────
  console.log(`      ${p(C.blue, '🔗')} ${p(C.blue, job.url)}`);
  console.log();
}

// ── Feed header ───────────────────────────────────────────────────────────
function renderHeader(title, count, query = '') {
  console.log(`\n${ruler('━', 72)}`);
  const q = query ? `  ${dim('for')} "${bold(cyan(query))}"` : '';
  console.log(`  ${bold(cyan('💼 ' + title))}${q}  ${dim(`(${count} results)`)}`);
  console.log(`${ruler('━', 72)}\n`);
}

// ── Stats footer ──────────────────────────────────────────────────────────
function renderStats(raw, deduped, displayed, opts = {}) {
  const bySource = (s) => raw.filter((j) => j.source === s).length;
  const withSalary = deduped.filter((j) => j.salary?.min).length;
  const remote = deduped.filter((j) => j.remote).length;

  const { level, exp } = opts;
  const levelStr = level ? ` · Level: ${bold(level)}` : exp ? ` · Exp: ${bold(exp + 'y')}` : '';

  console.log(ruler('─', 72));
  console.log(
    `  Sources:    ` +
    `${p(C.cyan,        `Remotive(${bySource('remotive')})`)}  ` +
    `${p(C.green,       `RemoteOK(${bySource('remoteok')})`)}  ` +
    `${p(C.magenta,     `Jobicy(${bySource('jobicy')})`)}  ` +
    `${p(C.yellow,      `Arbeitnow(${bySource('arbeitnow')})`)}  ` +
    `${p(C.brightGreen, `Instahyre(${bySource('instahyre')})`)}  ` +
    `${p(C.brightYellow,`LeetCode(${bySource('leetcode')})`)}  `
  );
  console.log(
    `  Pipeline:   Raw ${gray(raw.length)} → Deduped ${gray(deduped.length)} → Shown ${gray(displayed)}`
  );
  console.log(
    `  Details:    💰 ${green(withSalary)} with salary  · 🌐 ${cyan(remote)} remote${dim(levelStr)}`
  );
  console.log(ruler('─', 72) + '\n');
}

// ── Search meta header ────────────────────────────────────────────────────
function renderSearchMeta(opts) {
  const parts = [];
  if (opts.exp)       parts.push(`Experience: ${bold(opts.exp + ' years')} (${opts.resolvedLevel})`);
  if (opts.level)     parts.push(`Level: ${bold(opts.level)}`);
  if (opts.remote)    parts.push(`${green('Remote only')}`);
  if (opts.minSalary) parts.push(`Min salary: ${bold('$' + opts.minSalary.toLocaleString())}`);
  if (opts.location)  parts.push(`Location: ${bold(opts.location)}`);
  if (opts.sort)      parts.push(`Sorted by: ${bold(opts.sort)}`);
  if (parts.length > 0) {
    console.log(`  ${dim('Filters:')} ${parts.join('  ·  ')}\n`);
  }
}

module.exports = {
  renderHeader,
  renderJobCard,
  renderStats,
  renderSearchMeta,
  ruler,
  p, bold, dim, gray, cyan, green, red, C,
};
