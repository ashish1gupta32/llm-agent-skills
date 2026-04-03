// news.js — Tech News Aggregator (command registry pattern, zero npm deps)
// Usage: node scripts/news.js <command> [flags]

'use strict';

const { fetchAll }         = require('./lib/sources');
const { deduplicate, similarityReport } = require('./lib/dedup');
const { applySentiment, sortBySentiment, sortByTrending } = require('./lib/sentiment');
const { renderFeed, renderStats, renderSearchHeader, renderDuplicates, bold, cyan, dim, gray } = require('./lib/renderer');

// ── Flag parser ───────────────────────────────────────────────────────────────
// Parses:  --limit=20  --source=hn,devto  --sort=sentiment  --no-url
function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        flags[arg.slice(2)] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

// ── Shared pipeline ───────────────────────────────────────────────────────────
async function buildFeed(flags) {
  const limit       = parseInt(flags.limit || '30', 10);
  const sourceInput = flags.source || 'all';
  const ALL_SOURCES = ['hackernews', 'devto', 'reddit'];
  const ALIASES     = { hn: 'hackernews', dev: 'devto', rdt: 'reddit' };

  let sources;
  if (sourceInput === 'all') {
    sources = ALL_SOURCES;
  } else {
    sources = sourceInput.split(',').map((s) => ALIASES[s.trim()] || s.trim());
  }

  process.stdout.write(dim('  Fetching from sources...') + '\n');
  const raw     = await fetchAll(sources, limit);
  const deduped = deduplicate(raw);
  const scored  = applySentiment(deduped);

  return { raw, deduped, scored, sources };
}

function applySortAndLimit(items, flags) {
  const sort  = flags.sort || 'sentiment';
  const limit = parseInt(flags.limit || '20', 10);

  let sorted;
  if (sort === 'sentiment') sorted = sortBySentiment(items);
  else if (sort === 'trending') sorted = sortByTrending(items);
  else if (sort === 'score')  sorted = [...items].sort((a, b) => b.score - a.score);
  else if (sort === 'date')   sorted = [...items].sort((a, b) => b.timestamp - a.timestamp);
  else sorted = sortBySentiment(items);

  return sorted.slice(0, limit);
}

// ── Commands ──────────────────────────────────────────────────────────────────

/**
 * feed — Fetch, dedup, sentiment-rank, and display a news feed.
 *
 * Flags:
 *   --limit=N           Number of stories to show (default: 20)
 *   --source=all|hn,devto,reddit  Filter sources (default: all)
 *   --sort=sentiment|trending|score|date  (default: sentiment)
 *   --no-url            Hide URLs
 */
async function cmdFeed(positional, flags) {
  const { raw, deduped, scored } = await buildFeed(flags);
  const display = applySortAndLimit(scored, flags);
  const showUrl = !flags['no-url'];

  const sortLabel = flags.sort || 'sentiment';
  renderFeed(display, { title: `Tech News — sorted by ${sortLabel}`, showUrl });
  renderStats(raw, deduped, display.length);
}

/**
 * trending — Sort by combined popularity + sentiment score.
 *
 * Flags:  --limit=N  --source=...  --no-url
 */
async function cmdTrending(positional, flags) {
  flags = { ...flags, sort: 'trending' };
  const { raw, deduped, scored } = await buildFeed(flags);
  const display = applySortAndLimit(scored, flags);
  const showUrl = !flags['no-url'];

  renderFeed(display, { title: 'Trending Now — popularity + sentiment', showUrl });
  renderStats(raw, deduped, display.length);
}

/**
 * search <keyword> — Filter stories whose title contains <keyword>.
 *
 * Flags:  --limit=N  --source=...  --sort=...  --no-url
 */
async function cmdSearch(positional, flags) {
  const keyword = positional[0];
  if (!keyword) {
    console.error('Usage: node news.js search <keyword> [--limit=N] [--source=...]');
    process.exit(1);
  }

  const { raw, deduped, scored } = await buildFeed(flags);
  const kwLower = keyword.toLowerCase();
  const matched = scored.filter((i) => i.title.toLowerCase().includes(kwLower));
  const display = applySortAndLimit(matched, { ...flags, limit: flags.limit || '50' });
  const showUrl = !flags['no-url'];

  renderSearchHeader(keyword, display.length);

  if (display.length === 0) {
    console.log(`  ${dim('No stories found matching:')} "${keyword}"\n`);
    return;
  }

  renderFeed(display, { title: `Results for "${keyword}"`, showUrl });
  renderStats(raw, deduped, display.length);
}

/**
 * dupes — Show stories that would be deduplicated (debug view).
 *
 * Flags:  --threshold=0.55  --source=...
 */
async function cmdDupes(positional, flags) {
  const threshold = parseFloat(flags.threshold || '0.55');
  const { raw } = await buildFeed(flags);
  const pairs = similarityReport(raw, threshold);
  renderDuplicates(pairs);
  console.log(gray(`  (threshold: ${threshold}  |  raw items checked: ${raw.length})\n`));
}

/**
 * sources — List available news sources.
 */
async function cmdSources() {
  console.log(`\n${bold(cyan('  Available Sources'))}\n`);
  const rows = [
    ['hackernews', 'hn', 'Hacker News top stories (Firebase API)'],
    ['devto',      'dev','Dev.to top articles (REST API)'],
    ['reddit',     'rdt','r/programming top posts of the day'],
  ];
  rows.forEach(([name, alias, desc]) => {
    console.log(`  ${bold(name.padEnd(14))} ${dim(alias.padEnd(6))}  ${desc}`);
  });
  console.log();
}

// ── Command Registry ──────────────────────────────────────────────────────────
const commandRegistry = {
  feed: {
    fn: cmdFeed,
    args: ['[--limit=N]', '[--source=all|hn,devto,reddit]', '[--sort=sentiment|trending|score|date]'],
    minArgs: 0,
    description: 'Fetch aggregated, deduplicated, and sentiment-ranked feed',
  },
  trending: {
    fn: cmdTrending,
    args: ['[--limit=N]', '[--source=...]'],
    minArgs: 0,
    description: 'Top stories ranked by combined popularity + sentiment',
  },
  search: {
    fn: cmdSearch,
    args: ['<keyword>', '[--limit=N]', '[--source=...]', '[--sort=...]'],
    minArgs: 1,
    description: 'Search stories by keyword across all sources',
  },
  dupes: {
    fn: cmdDupes,
    args: ['[--threshold=0.55]', '[--source=...]'],
    minArgs: 0,
    description: 'Debug: show near-duplicate pairs before deduplication',
  },
  sources: {
    fn: cmdSources,
    args: [],
    minArgs: 0,
    description: 'List all available news sources and their aliases',
  },
};

// ── Help printer ──────────────────────────────────────────────────────────────
function printHelp() {
  console.log(`\n${bold(cyan('  ⚡ Tech News Aggregator'))}  ${dim('v1.0.0')}`);
  console.log(dim('  Multi-source • Deduplicated • Sentiment-ranked\n'));
  console.log(`  ${bold('Usage:')}  node scripts/news.js <command> [flags]\n`);
  console.log(`  ${bold('Commands:')}`);
  for (const [name, { args, description }] of Object.entries(commandRegistry)) {
    const sig = `    ${name} ${args.join(' ')}`;
    console.log(`${sig}`);
    console.log(`${dim('      → ' + description)}\n`);
  }
  console.log('  ' + dim('Examples:'));
  console.log('    node scripts/news.js feed');
  console.log('    node scripts/news.js feed --limit=15 --sort=score');
  console.log('    node scripts/news.js feed --source=hn,devto --sort=date');
  console.log('    node scripts/news.js trending --limit=10');
  console.log('    node scripts/news.js search "rust" --limit=10');
  console.log('    node scripts/news.js search "AI" --source=devto');
  console.log('    node scripts/news.js dupes --threshold=0.5\n');
}

// ── Command Runner (wrapper) ──────────────────────────────────────────────────
function createCommandRunner(registry) {
  return async function run(commandName, positional, flags) {
    const cmd = registry[commandName];

    if (!cmd) {
      console.error(`\n  Unknown command: "${commandName}"\n`);
      printHelp();
      process.exit(1);
    }

    if (positional.length < cmd.minArgs) {
      console.error(`\n  Usage: node scripts/news.js ${commandName} ${cmd.args.join(' ')}\n`);
      process.exit(1);
    }

    try {
      await cmd.fn(positional, flags);
    } catch (err) {
      console.error(`\n  Error: ${err.message}`);
      if (process.env.DEBUG) console.error(err.stack);
      process.exit(1);
    }
  };
}

// ── Entry point ───────────────────────────────────────────────────────────────
const [commandName, ...rest] = process.argv.slice(2);

if (!commandName || commandName === 'help' || commandName === '--help') {
  printHelp();
  process.exit(0);
}

const { flags, positional } = parseFlags(rest);
const runCommand = createCommandRunner(commandRegistry);
runCommand(commandName, positional, flags);
