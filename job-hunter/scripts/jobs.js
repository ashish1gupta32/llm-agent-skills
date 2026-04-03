// jobs.js — Job Hunter Skill (command registry pattern, zero npm deps)
// Usage: node scripts/jobs.js <command> [options]

'use strict';

const { fetchAll, formatSalary, inferLevel } = require('./lib/sources');
const { filterAndScore, sortJobs, deduplicateJobs, yearsToLevel } = require('./lib/filters');
const {
  renderHeader, renderJobCard, renderStats, renderSearchMeta,
  bold, dim, cyan, gray, green, red, p, C, ruler,
} = require('./lib/renderer');

// ── Flag / arg parser ─────────────────────────────────────────────────────
function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      else           flags[arg.slice(2)]      = true;
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

// ── Shared pipeline ───────────────────────────────────────────────────────
async function buildJobFeed(keyword, flags) {
  const limit      = parseInt(flags.limit || '25', 10);
  const sourceArg  = flags.source || 'all';
  const ALL        = ['remotive', 'remoteok', 'jobicy', 'arbeitnow'];
  const ALIAS      = { ro: 'remoteok', jc: 'jobicy', an: 'arbeitnow', re: 'remotive' };

  const sources = sourceArg === 'all'
    ? ALL
    : sourceArg.split(',').map((s) => ALIAS[s.trim()] || s.trim());

  process.stdout.write(dim(`  🔍 Searching "${keyword}" across sources...\n`));

  const raw = await fetchAll({
    keyword,
    sources,
    limit,
    location: flags.location || '',
    years:    flags.exp ? parseInt(flags.exp, 10) : 0,
  });

  const filterOpts = {
    keyword,
    level:     flags.level   || null,
    exp:       flags.exp     ? parseInt(flags.exp, 10) : null,
    remote:    flags.remote  === true || flags.remote === 'true',
    minSalary: flags['min-salary'] ? parseInt(flags['min-salary'], 10) : 0,
    location:  flags.location || '',
    type:      flags.type    || '',
  };

  const filtered  = filterAndScore(raw, filterOpts);
  const deduped   = deduplicateJobs(filtered);
  const sorted    = sortJobs(deduped, flags.sort || 'relevance');

  return { raw, deduped, sorted, filterOpts };
}

// ── COMMAND: search ───────────────────────────────────────────────────────
async function cmdSearch(positional, flags) {
  const keyword = positional.join(' ').trim();
  if (!keyword) {
    console.error(dim('\n  Usage: node scripts/jobs.js search <job title / skills> [flags]\n'));
    console.error(dim('  Example: node scripts/jobs.js search "React developer" --exp=3 --remote\n'));
    process.exit(1);
  }

  const { raw, deduped, sorted, filterOpts } = await buildJobFeed(keyword, flags);
  const limit   = parseInt(flags.limit || '15', 10);
  const display = sorted.slice(0, limit);
  const showDesc = !flags['no-desc'];
  const resolvedLevel = filterOpts.level || yearsToLevel(filterOpts.exp) || 'any';

  renderHeader('Job Search Results', display.length, keyword);
  renderSearchMeta({ ...filterOpts, resolvedLevel });

  if (display.length === 0) {
    console.log(`  ${red('No jobs found matching your criteria.')}`);
    console.log(`  ${dim('Try broadening your search:')}`);
    console.log(`    ${dim('- Remove --remote or --min-salary')}`);
    console.log(`    ${dim('- Use a shorter keyword')}`);
    console.log(`    ${dim('- Try --source=all\n')}`);
    return;
  }

  display.forEach((job, i) => renderJobCard(job, i, { showDesc, formatSalary }));
  renderStats(raw, deduped, display.length, { level: filterOpts.level, exp: filterOpts.exp });
}

// ── COMMAND: latest ───────────────────────────────────────────────────────
async function cmdLatest(positional, flags) {
  const keyword = positional.join(' ').trim() || 'software engineer';
  flags = { ...flags, sort: 'date' };

  const { raw, deduped, sorted, filterOpts } = await buildJobFeed(keyword, flags);
  const limit   = parseInt(flags.limit || '15', 10);
  const display = sorted.slice(0, limit);

  renderHeader('Latest Job Postings', display.length, keyword);

  if (display.length === 0) {
    console.log(red('  No recent jobs found.\n'));
    return;
  }

  display.forEach((job, i) => renderJobCard(job, i, { showDesc: false, formatSalary }));
  renderStats(raw, deduped, display.length, filterOpts);
}

// ── COMMAND: salary ───────────────────────────────────────────────────────
async function cmdSalary(positional, flags) {
  const keyword = positional.join(' ').trim();
  if (!keyword) {
    console.error(dim('\n  Usage: node scripts/jobs.js salary <role>\n'));
    process.exit(1);
  }

  const { raw, deduped } = await buildJobFeed(keyword, { ...flags, source: 'all' });
  const withSalary = deduped
    .filter((j) => j.salary?.min && j.salary.min > 10_000)
    .sort((a, b) => (b.salary.min || 0) - (a.salary.min || 0));

  renderHeader('Salary Intelligence', withSalary.length, keyword);

  if (withSalary.length === 0) {
    console.log(dim('  Not enough salary data found for this role. Try a broader search.\n'));
    return;
  }

  // Stats
  const mins = withSalary.map((j) => j.salary.min).filter(Boolean);
  const maxs = withSalary.map((j) => j.salary.max).filter((x) => x && x > 10_000);

  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const fmt = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;

  console.log(`  ${bold('Salary Range Summary for:')} "${cyan(keyword)}"\n`);
  console.log(`  ${bold('Lowest offered')}  : ${fmt(Math.min(...mins))}`);
  console.log(`  ${bold('Highest offered')} : ${fmt(Math.max(...maxs.length ? maxs : mins))}`);
  console.log(`  ${bold('Average min')}     : ${green(fmt(avg(mins)))}`);
  if (maxs.length > 0)
    console.log(`  ${bold('Average max')}     : ${green(fmt(avg(maxs)))}`);
  console.log(`  ${bold('Data points')}     : ${dim(mins.length + ' jobs with salary info')}\n`);

  // Top paying jobs
  console.log(`  ${bold('Top-paying open roles:')}\n`);
  withSalary.slice(0, 8).forEach((job, i) => {
    const sal = formatSalary(job.salary) || 'N/A';
    console.log(
      `  ${dim(String(i + 1).padStart(2) + '.')}  ${bold(green(sal.padEnd(18)))}  ` +
      `${job.title.slice(0, 40).padEnd(42)}  ${dim(job.company)}  ` +
      `${p(C.blue, '🔗 ' + job.url.slice(0, 40) + '…')}`
    );
  });
  console.log();
}

// ── COMMAND: companies ────────────────────────────────────────────────────
async function cmdCompanies(positional, flags) {
  const keyword = positional.join(' ').trim() || 'software';

  const { raw } = await buildJobFeed(keyword, { ...flags, source: 'all', limit: '50' });

  // Count postings per company
  const coMap = {};
  for (const j of raw) {
    const k = j.company.trim();
    if (!coMap[k]) coMap[k] = { name: k, count: 0, jobs: [], source: j.source };
    coMap[k].count++;
    coMap[k].jobs.push(j.title);
  }

  const sorted = Object.values(coMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, parseInt(flags.limit || '15', 10));

  renderHeader('Most Active Hiring Companies', sorted.length, keyword);

  sorted.forEach((co, i) => {
    const src = co.source;
    console.log(
      `  ${dim(String(i + 1).padStart(2) + '.')}  ${bold(co.name.padEnd(35))}  ` +
      `${green(co.count + ' opening' + (co.count > 1 ? 's' : ''))}  ` +
      `${gray(co.jobs.slice(0, 2).join(' · '))}`
    );
  });
  console.log();
}

// ── COMMAND: sources ──────────────────────────────────────────────────────
async function cmdSources() {
  console.log(`\n${ruler('\u2501', 72)}`);
  console.log(`  ${bold(cyan('\ud83d\udce1 Supported Job Sources'))}\n`);
  const rows = [
    ['remotive',  're',  'Remotive.com',   'Remote-first. 1000s of tech/design/marketing jobs.'],
    ['remoteok',  'ro',  'RemoteOK.com',   'Developer-focused. Often includes salary ranges.'],
    ['jobicy',    'jc',  'Jobicy.com',     'Global remote with level & industry filters.'],
    ['arbeitnow', 'an',  'Arbeitnow.com',  'European & global. On-site + remote.'],
    ['instahyre', 'ih',  'Instahyre.com',  '\ud83c\uddfb\ud83c\uddf3 INDIA-SPECIFIC. Tech jobs from Indian companies.'],
    ['leetcode',  'lc',  'LeetCode Discuss','Community job/hiring discussions via GraphQL API.'],
  ];
  rows.forEach(([id, alias, label, desc]) => {
    const isIndia = id === 'instahyre';
    const color = isIndia ? C.brightGreen : C.cyan;
    console.log(`  ${bold(p(color, id.padEnd(12)))} ${dim(alias.padEnd(6))}  ${p(C.yellow, label.padEnd(20))}  ${dim(desc)}`);
  });
  console.log();
  console.log(`  ${dim('Note: LinkedIn, Indeed, Glassdoor require OAuth/paid API access.')}`);
  console.log(`  ${dim('Use --source=instahyre for India-specific results.')}\n`);
  console.log(ruler('\u2501', 72) + '\n');
}

// ── Command Registry ──────────────────────────────────────────────────────
const commandRegistry = {
  search: {
    fn: cmdSearch,
    args: ['<role/skills>', '[flags]'],
    minArgs: 1,
    description: 'Search jobs matching your role, skills, experience, and preferences',
  },
  latest: {
    fn: cmdLatest,
    args: ['[role]', '[flags]'],
    minArgs: 0,
    description: 'Most recently posted jobs (sorted by date)',
  },
  salary: {
    fn: cmdSalary,
    args: ['<role>'],
    minArgs: 1,
    description: 'Salary intelligence and range stats for a role',
  },
  companies: {
    fn: cmdCompanies,
    args: ['<keyword>', '[flags]'],
    minArgs: 0,
    description: 'Most active hiring companies for a keyword',
  },
  sources: {
    fn: cmdSources,
    args: [],
    minArgs: 0,
    description: 'List all supported job board sources',
  },
};

// ── Help ──────────────────────────────────────────────────────────────────
function printHelp() {
  console.log(`\n${bold(cyan('  💼 Job Hunter Skill'))}  ${dim('v1.0.0')}`);
  console.log(dim('  Multi-source · Filtered · Salary-aware · Relevance-ranked\n'));
  console.log(`  ${bold('Usage:')}  node scripts/jobs.js <command> [flags]\n`);
  console.log(`  ${bold('Commands:')}`);
  for (const [name, { args, description }] of Object.entries(commandRegistry)) {
    console.log(`    ${bold(name)} ${args.join(' ')}`);
    console.log(`    ${dim('→ ' + description)}\n`);
  }
  console.log(`  ${bold('Common Flags:')}`);
  const flags = [
    ['--exp=<years>',       'Years of experience (0-10+). Auto-maps to level.'],
    ['--level=<lvl>',       'junior | mid | senior | staff'],
    ['--remote',            'Remote positions only'],
    ['--min-salary=<USD>',  'Minimum annual salary (e.g. 80000)'],
    ['--location=<city>',   'Filter by location (e.g. "New York")'],
    ['--source=<list>',     'Comma-separated: remotive,remoteok,jobicy,arbeitnow (or "all")'],
    ['--sort=<by>',         'relevance | date | salary | company'],
    ['--limit=<n>',         'Max results to show (default: 15)'],
    ['--no-desc',           'Hide job description snippets'],
  ];
  flags.forEach(([f, d]) => {
    console.log(`    ${cyan(f.padEnd(26))} ${dim(d)}`);
  });
  console.log(`\n  ${bold('Examples:')}`);
  const examples = [
    'node scripts/jobs.js search "frontend developer" --exp=2 --remote',
    'node scripts/jobs.js search "backend engineer Node.js" --level=senior --min-salary=120000',
    'node scripts/jobs.js search "data scientist python" --remote --sort=salary',
    'node scripts/jobs.js search "ML engineer" --source=remotive,remoteok',
    'node scripts/jobs.js salary "senior react developer"',
    'node scripts/jobs.js latest "devops" --remote --limit=10',
    'node scripts/jobs.js companies "golang" --limit=10',
  ];
  examples.forEach((e) => console.log(`    ${dim(e)}`));
  console.log();
}

// ── Command Runner (wrapper) ──────────────────────────────────────────────
function createCommandRunner(registry) {
  return async function run(commandName, positional, flags) {
    const cmd = registry[commandName];
    if (!cmd) {
      console.error(`\n  ${red('Unknown command:')} "${commandName}"\n`);
      printHelp();
      process.exit(1);
    }
    if (positional.length < cmd.minArgs) {
      console.error(`\n  ${dim('Usage:')} node scripts/jobs.js ${commandName} ${cmd.args.join(' ')}\n`);
      process.exit(1);
    }
    try {
      await cmd.fn(positional, flags);
    } catch (err) {
      console.error(`\n  ${red('Error:')} ${err.message}`);
      if (process.env.DEBUG) console.error(err.stack);
      process.exit(1);
    }
  };
}

// ── Entry Point ───────────────────────────────────────────────────────────
const [commandName, ...rest] = process.argv.slice(2);

if (!commandName || commandName === 'help' || commandName === '--help') {
  printHelp();
  process.exit(0);
}

const { flags, positional } = parseFlags(rest);
const runCommand = createCommandRunner(commandRegistry);
runCommand(commandName, positional, flags);
