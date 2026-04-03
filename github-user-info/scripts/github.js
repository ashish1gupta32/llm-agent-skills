// github.js — Command Registry Pattern (no switch-case)
const headers = {
  'User-Agent': 'Node-JS-Skills-Bot',
  Accept: 'application/vnd.github+json',
};

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function githubFetch(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    if (response.status === 404) throw new Error('NOT_FOUND');
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// ─── Command Implementations ──────────────────────────────────────────────────

async function fetchGithubUser([username]) {
  const data = await githubFetch(`https://api.github.com/users/${username}`);

  console.log(`\n--- GitHub Profile: ${username} ---`);
  console.log(`Name         : ${data.name || 'N/A'}`);
  console.log(`Bio          : ${data.bio || 'N/A'}`);
  console.log(`Public Repos : ${data.public_repos}`);
  console.log(`Followers    : ${data.followers}`);
  console.log(`Profile URL  : ${data.html_url}`);

  if (data.public_repos > 0) {
    console.log('\nFetching repositories...');
    const repos = await githubFetch(
      `https://api.github.com/users/${username}/repos?per_page=100`
    );
    console.log(`\n--- Repositories (${repos.length} returned) ---`);
    repos.forEach((r) => console.log(`  - ${r.name}: ${r.html_url}`));
  }
}

async function fetchRepoDetails([owner, repo]) {
  const data = await githubFetch(`https://api.github.com/repos/${owner}/${repo}`);

  console.log(`\n--- Repository: ${data.full_name} ---`);
  console.log(`Description  : ${data.description || 'None'}`);
  console.log(`URL          : ${data.html_url}`);
  console.log(`Stars        : ${data.stargazers_count}`);
  console.log(`Forks        : ${data.forks_count}`);
  console.log(`Open Issues  : ${data.open_issues_count}`);
  console.log(`Language     : ${data.language || 'Unknown'}`);
  console.log(`Topics       : ${data.topics?.length ? data.topics.join(', ') : 'None'}`);
  console.log(`Created At   : ${data.created_at}`);
  console.log(`Last Updated : ${data.updated_at}`);
}

async function fetchContributions([username, startDate, endDate]) {
  if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
    throw new Error('Invalid date format. Use YYYY-MM-DD.');
  }
  const query = encodeURIComponent(
    `author:${username} committer-date:${startDate}..${endDate}`
  );
  const data = await githubFetch(
    `https://api.github.com/search/commits?q=${query}`
  );

  console.log(`\n--- Contributions: ${username} ---`);
  console.log(`Range         : ${startDate} → ${endDate}`);
  console.log(`Total Commits : ${data.total_count}`);
  if (data.total_count > 0)
    console.log(`Note: Reflects commits indexed by GitHub Search.`);
}

// ─── Command Registry ─────────────────────────────────────────────────────────
// Each entry:  { fn, args: [description], minArgs }

const commandRegistry = {
  user: {
    fn: fetchGithubUser,
    args: ['<username>'],
    minArgs: 1,
    description: 'Fetch user stats and public repositories',
  },
  repo: {
    fn: fetchRepoDetails,
    args: ['<owner>', '<repo-name>'],
    minArgs: 2,
    description: 'Fetch repository metadata (stars, forks, language…)',
  },
  contributions: {
    fn: fetchContributions,
    args: ['<username>', '<start-date>', '<end-date>'],
    minArgs: 3,
    description: 'Count commits by a user within a date range',
  },
};

// ─── Command Wrapper ──────────────────────────────────────────────────────────

function createCommandRunner(registry) {
  return async function run(commandName, args) {
    const cmd = registry[commandName];

    // Unknown command
    if (!cmd) {
      console.error(`Unknown command: "${commandName}"\n`);
      printHelp(registry);
      process.exit(1);
    }

    // Validate minimum arg count
    if (args.length < cmd.minArgs) {
      console.error(
        `Usage: node github.js ${commandName} ${cmd.args.join(' ')}`
      );
      process.exit(1);
    }

    try {
      await cmd.fn(args);
    } catch (err) {
      if (err.message === 'NOT_FOUND') {
        console.error(`Not found: "${args.join(' ')}"`);
      } else {
        console.error(`Error: ${err.message}`);
      }
      process.exit(1);
    }
  };
}

function printHelp(registry) {
  console.log('Usage: node github.js <command> [arguments]\n');
  console.log('Commands:');
  for (const [name, { args, description }] of Object.entries(registry)) {
    const usage = `  ${name} ${args.join(' ')}`.padEnd(52);
    console.log(`${usage}${description}`);
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

const [command, ...rest] = process.argv.slice(2);

if (!command) {
  printHelp(commandRegistry);
  process.exit(0);
}

const runCommand = createCommandRunner(commandRegistry);
runCommand(command, rest);
