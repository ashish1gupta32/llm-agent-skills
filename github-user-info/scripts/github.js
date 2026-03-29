// github.js
const headers = { 'User-Agent': 'Node-JS-Skills-Bot' };

async function fetchGithubUser(username) {
  try {
    const response = await fetch(`https://api.github.com/users/${username}`, { headers });
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`User ${username} not found.`);
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`--- GitHub Info for ${username} ---`);
    console.log(`Name: ${data.name || 'Not Available'}`);
    console.log(`Bio: ${data.bio || 'Not Available'}`);
    console.log(`Public Repos: ${data.public_repos}`);
    console.log(`Followers: ${data.followers}`);
    console.log(`Profile URL: ${data.html_url}`);

    if (data.public_repos > 0) {
      console.log(`\nFetching repository URLs...`);
      const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`, { headers });
      if (reposResponse.ok) {
        const repos = await reposResponse.json();
        console.log(`--- Repositories (${repos.length} returned) ---`);
        repos.forEach(repo => console.log(`- ${repo.name}: ${repo.html_url}`));
      }
    }
  } catch (error) {
    console.error('Failed to fetch GitHub user info:', error.message);
  }
}

async function fetchRepoDetails(owner, repo) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Repository ${owner}/${repo} not found.`);
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`--- Repository Info: ${data.full_name} ---`);
    console.log(`Description: ${data.description || 'No description provided'}`);
    console.log(`URL: ${data.html_url}`);
    console.log(`Stars: ${data.stargazers_count}`);
    console.log(`Forks: ${data.forks_count}`);
    console.log(`Open Issues: ${data.open_issues_count}`);
    console.log(`Language: ${data.language || 'Not properly detected'}`);
    console.log(`Topics: ${data.topics && data.topics.length > 0 ? data.topics.join(', ') : 'None'}`);
    console.log(`Created At: ${data.created_at}`);
    console.log(`Last Updated: ${data.updated_at}`);
  } catch (error) {
    console.error('Failed to fetch repository info:', error.message);
  }
}

async function fetchContributions(username, startDate, endDate) {
  try {
    if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
      console.log('Invalid date format. Please use YYYY-MM-DD');
      return;
    }

    const query = encodeURIComponent(`author:${username} committer-date:${startDate}..${endDate}`);
    const url = `https://api.github.com/search/commits?q=${query}`;
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`--- Contributions for ${username} ---`);
    console.log(`Time Range: ${startDate} to ${endDate}`);
    console.log(`Total Commits Found: ${data.total_count}`);
    if (data.total_count > 0) {
      console.log(`Note: This reflects commits authored by ${username} and indexed by GitHub Search.`);
    }
  } catch (error) {
    console.error('Failed to fetch contributions info:', error.message);
  }
}

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log('Usage: node github.js <command> [arguments]');
  console.log('Commands:');
  console.log('  user <username>                                - Fetch user stats and repositories');
  console.log('  repo <owner> <repo-name>                       - Fetch repository details');
  console.log('  contributions <username> <start-date> <end-date> - Fetch total commits in date range');
  process.exit(1);
}

switch (command) {
  case 'user':
    if (args.length < 2) console.log('Usage: node github.js user <username>');
    else fetchGithubUser(args[1]);
    break;
  case 'repo':
    if (args.length < 3) console.log('Usage: node github.js repo <owner> <repo-name>');
    else fetchRepoDetails(args[1], args[2]);
    break;
  case 'contributions':
    if (args.length < 4) console.log('Usage: node github.js contributions <username> <YYYY-MM-DD> <YYYY-MM-DD>');
    else fetchContributions(args[1], args[2], args[3]);
    break;
  default:
    console.log(`Unknown command: ${command}`);
}
