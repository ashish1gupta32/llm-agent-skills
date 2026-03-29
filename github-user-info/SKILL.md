---
name: Fetch GitHub User Info
description: Retrieves public information and statistics about a given GitHub username and repositories.
---
# GitHub User Info Skill

This skill allows you to retrieve public profile stats, repository details, and contribution data for specific GitHub users and repositories using the GitHub REST API.

## Capabilities

All capabilities are accessible via a single script `scripts/github.js`

### 1. Fetch User Info & Repositories
Retrieve basic stats (Name, Bio, Public Repos, Followers) and a list of all public repository URLs.
```bash
node scripts/github.js user <github-username>
```
Example: `node scripts/github.js user octocat`

### 2. Fetch Repository Details
Retrieve specific metadata about a repository (Description, Stars, Forks, Language, Topics, Issues, etc.).
```bash
node scripts/github.js repo <owner> <repo>
```
Example: `node scripts/github.js repo octocat Hello-World`

### 3. Fetch Contributions Over Time
Get the total number of commits by a user within a specific date range. Note: Uses GitHub Search API.
```bash
node scripts/github.js contributions <github-username> <start-date> <end-date>
```
Example: `node scripts/github.js contributions octocat 2023-01-01 2023-12-31`
