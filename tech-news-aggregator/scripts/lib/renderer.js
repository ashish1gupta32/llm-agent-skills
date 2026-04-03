// lib/renderer.js — ANSI-colored terminal output (no npm deps)

// ── ANSI color codes ─────────────────────────────────────────────────────────
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  italic:  '\x1b[3m',
  // Foreground colors
  black:   '\x1b[30m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  gray:    '\x1b[90m',
  // Bright foreground
  brightRed:   '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightBlue:  '\x1b[94m',
  brightCyan:  '\x1b[96m',
};

const SOURCE_STYLE = {
  hackernews: { color: C.yellow,  badge: ' HN  ', icon: '🔶' },
  devto:      { color: C.magenta, badge: ' DEV ', icon: '🟣' },
  reddit:     { color: C.blue,    badge: ' RDT ', icon: '🔵' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function paint(color, text) {
  return `${color}${text}${C.reset}`;
}

function bold(text)  { return `${C.bold}${text}${C.reset}`; }
function dim(text)   { return `${C.dim}${text}${C.reset}`; }
function gray(text)  { return paint(C.gray, text); }
function cyan(text)  { return paint(C.cyan, text); }
function green(text) { return paint(C.green, text); }
function red(text)   { return paint(C.red, text); }

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

function formatAge(date) {
  if (!date || isNaN(date.getTime())) return 'unknown';
  const diff = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ruler(char = '─', width = 60) {
  return gray(char.repeat(width));
}

// ── Feed renderer ─────────────────────────────────────────────────────────────
function renderFeed(items, { title = 'Tech News Feed', showUrl = true } = {}) {
  const header = `  ${bold(cyan('⚡ ' + title))}  ${dim(`(${items.length} stories)`)}`;
  console.log(`\n${ruler('━', 70)}`);
  console.log(header);
  console.log(`${ruler('━', 70)}\n`);

  items.forEach((item, idx) => {
    const style  = SOURCE_STYLE[item.source] || { color: C.white, badge: ' SRC ', icon: '▪' };
    const badge  = `${style.color}${C.bold}${style.badge}${C.reset}`;
    const num    = dim(String(idx + 1).padStart(3) + '.');
    const label  = item.sentimentLabel || '🟡';

    // Line 1: number + sentiment + title
    console.log(`${num} ${label}  ${bold(item.title)}`);

    // Line 2: source badge + score + comments + age
    const upvotes  = gray(`↑${item.score.toLocaleString()}`);
    const comments = gray(`💬 ${item.comments.toLocaleString()}`);
    const age      = dim(formatAge(item.timestamp));
    const author   = dim(`@${item.author}`);
    console.log(`       ${badge}  ${upvotes}  ${comments}  ${age}  ${author}`);

    // Line 3: tags (if any)
    if (item.tags && item.tags.length > 0) {
      const tags = item.tags.map((t) => gray(`#${t}`)).join('  ');
      console.log(`       ${tags}`);
    }

    // Line 4: URL
    if (showUrl) {
      console.log(`       ${paint(C.blue, truncate(item.url, 80))}`);
    }

    console.log(); // blank line between items
  });
}

// ── Stats footer ──────────────────────────────────────────────────────────────
function renderStats(raw, deduped, sources) {
  const bySource = (src) => raw.filter((i) => i.source === src).length;
  const positive = deduped.filter((i) => (i.sentimentScore || 0) > 0.05).length;
  const negative = deduped.filter((i) => (i.sentimentScore || 0) < -0.05).length;
  const neutral  = deduped.length - positive - negative;

  console.log(ruler('─', 70));
  console.log(
    `  Sources fetched:  ` +
    `${paint(C.yellow, `HN(${bySource('hackernews')})`)}  ` +
    `${paint(C.magenta, `DEV(${bySource('devto')})`)}  ` +
    `${paint(C.blue, `RDT(${bySource('reddit')})`)}`
  );
  console.log(
    `  Pipeline:         Raw ${gray(raw.length)} → Deduped ${gray(deduped.length)} → Displayed ${gray(sources)}`
  );
  console.log(
    `  Sentiment split:  ${green('🟢 ' + positive)}  🟡 ${neutral}  ${red('🔴 ' + negative)}`
  );
  console.log(ruler('─', 70) + '\n');
}

// ── Search result header ──────────────────────────────────────────────────────
function renderSearchHeader(keyword, count) {
  console.log(`\n${ruler('━', 70)}`);
  console.log(`  ${bold(cyan('🔍 Search:'))} "${bold(keyword)}"  ${dim(`— ${count} result${count !== 1 ? 's' : ''}`)}`);
  console.log(`${ruler('━', 70)}\n`);
}

// ── Similarity debug view ─────────────────────────────────────────────────────
function renderDuplicates(pairs) {
  if (pairs.length === 0) {
    console.log(green('\n  No near-duplicates found at current threshold.\n'));
    return;
  }
  console.log(`\n${ruler('━', 70)}`);
  console.log(`  ${bold(cyan('🔗 Near-Duplicate Pairs'))}  ${dim(`(${pairs.length} found)`)}`);
  console.log(`${ruler('━', 70)}\n`);
  pairs.forEach((p, i) => {
    console.log(`  ${dim(String(i + 1) + '.')} Similarity: ${bold(String(p.similarity))}`);
    console.log(`     ${paint(C.yellow, '[' + p.aSource + ']')} ${p.a}`);
    console.log(`     ${paint(C.blue,   '[' + p.bSource + ']')} ${p.b}`);
    console.log();
  });
}

module.exports = {
  renderFeed,
  renderStats,
  renderSearchHeader,
  renderDuplicates,
  paint,
  bold,
  dim,
  gray,
  cyan,
  C,
};
