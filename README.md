# nodejs-skills-practice

A collection of Node.js AI skills that interact with public APIs — built to explore how agentic skills work in LLM workflows.

## Skills

### 1. GitHub User Info (`github-user-info/`)
Fetch GitHub user profile, repository list, and contribution stats.

```bash
node github-user-info/scripts/github.js user <username>
node github-user-info/scripts/github.js repo <owner> <repo-name>
node github-user-info/scripts/github.js contributions <username> <YYYY-MM-DD> <YYYY-MM-DD>
```

### 2. Public IP Checker (`public-ip-checker/`)
Get the current machine's public IP address using the [ipify](https://www.ipify.org/) API.

```bash
node public-ip-checker/scripts/check-ip.js
```

### 3. Random Joke Fetcher (`random-joke-fetcher/`)
Fetch a random joke from the [Official Joke API](https://official-joke-api.appspot.com/).

```bash
node random-joke-fetcher/scripts/fetch-joke.js
```

### 4. Tech News Aggregator (`tech-news-aggregator/`)
Fetches tech news from Hacker News, Dev.to, and Reddit simultaneously. Features trigram deduplication and sentiment ranking.

```bash
node tech-news-aggregator/scripts/news.js feed --limit=15
node tech-news-aggregator/scripts/news.js trending
node tech-news-aggregator/scripts/news.js search "AI"
```

### 5. Job Hunter (`job-hunter/`)
A multi-source, relevance-ranked job board aggregator (Remotive, RemoteOK, Jobicy, Arbeitnow, Instahyre, LeetCode) featuring experience level filtering, salary parsing, and ANSI-coloured job cards.

```bash
node job-hunter/scripts/jobs.js search "backend developer" --exp=4 --remote
node job-hunter/scripts/jobs.js salary "react developer"
node job-hunter/scripts/jobs.js latest "devops"
```

## Requirements

- Node.js v18+ (uses native `fetch`)
- No npm dependencies needed
