// lib/sources.js — Multi-source fetchers (HN, Dev.to, Reddit)

const HEADERS = { 'User-Agent': 'NodeJS-News-Aggregator-Skill/1.0' };

// ── Concurrency helper ──────────────────────────────────────────────────────
async function fetchInBatches(tasks, batchSize = 10) {
  const results = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map((t) => t()));
    batchResults.forEach((r) => {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    });
  }
  return results;
}

// ── Hacker News (Firebase API) ──────────────────────────────────────────────
async function fetchHackerNews(limit = 30) {
  const idsRes = await fetch(
    'https://hacker-news.firebaseio.com/v0/topstories.json',
    { headers: HEADERS }
  );
  if (!idsRes.ok) throw new Error('HN API unavailable');
  const ids = (await idsRes.json()).slice(0, limit);

  const stories = await fetchInBatches(
    ids.map((id) => async () => {
      const res = await fetch(
        `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
        { headers: HEADERS }
      );
      return res.ok ? res.json() : null;
    }),
    10
  );

  return stories
    .filter((s) => s && s.type === 'story' && s.title && !s.deleted)
    .map((s) => ({
      id: `hn_${s.id}`,
      title: s.title,
      url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
      source: 'hackernews',
      score: s.score || 0,
      comments: s.descendants || 0,
      author: s.by || 'unknown',
      timestamp: new Date((s.time || 0) * 1000),
      tags: [],
    }));
}

// ── Dev.to ──────────────────────────────────────────────────────────────────
async function fetchDevTo(limit = 30) {
  const res = await fetch(
    `https://dev.to/api/articles?top=1&per_page=${limit}`,
    { headers: HEADERS }
  );
  if (!res.ok) throw new Error('Dev.to API unavailable');
  const articles = await res.json();

  return articles.map((a) => ({
    id: `devto_${a.id}`,
    title: a.title,
    url: a.url,
    source: 'devto',
    score: a.public_reactions_count || 0,
    comments: a.comments_count || 0,
    author: a.user?.username || 'unknown',
    timestamp: new Date(a.published_at),
    tags: a.tag_list || [],
  }));
}

// ── Reddit r/programming ────────────────────────────────────────────────────
async function fetchReddit(limit = 30) {
  const res = await fetch(
    `https://www.reddit.com/r/programming/top.json?limit=${limit}&t=day`,
    { headers: HEADERS }
  );
  if (!res.ok) throw new Error('Reddit API unavailable');
  const data = await res.json();

  return data.data.children
    .map((c) => c.data)
    .filter((p) => !p.is_self)          // skip text posts
    .map((p) => ({
      id: `reddit_${p.id}`,
      title: p.title,
      url: p.url,
      source: 'reddit',
      score: p.score || 0,
      comments: p.num_comments || 0,
      author: p.author || 'unknown',
      timestamp: new Date((p.created_utc || 0) * 1000),
      tags: [p.link_flair_text].filter(Boolean),
    }));
}

// ── Fan-out: fetch from all (or filtered) sources ───────────────────────────
async function fetchAll(sources = ['hackernews', 'devto', 'reddit'], limit = 30) {
  const fetchers = {
    hackernews: () => fetchHackerNews(limit),
    devto: () => fetchDevTo(limit),
    reddit: () => fetchReddit(limit),
  };

  const enabled = sources.filter((s) => fetchers[s]);
  const results = await Promise.allSettled(enabled.map((s) => fetchers[s]()));

  const items = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      items.push(...r.value);
    } else {
      console.error(`  ⚠  ${enabled[i]}: ${r.reason?.message || 'fetch failed'}`);
    }
  });

  return items;
}

module.exports = { fetchAll, fetchHackerNews, fetchDevTo, fetchReddit };
