// lib/sources.js — Job board fetchers (Remotive, RemoteOK, Jobicy, Arbeitnow, Instahyre, LeetCode)
// All endpoints are free and public. Instahyre is India-specific.

'use strict';

const HEADERS = { 'User-Agent': 'NodeJS-JobHunter-Skill/1.0' };

// ── Normalised job schema ──────────────────────────────────────────────────
// {
//   id, title, company, location, remote,
//   salary: { min, max, currency, raw },
//   level, tags, type, url, postedAt, source, description
// }

// ── Salary parser (regex-based, zero deps) ───────────────────────────────
function parseSalary(raw) {
  if (!raw || String(raw).trim() === '') return null;
  const s = String(raw).replace(/,/g, '');

  const patterns = [
    // $80k - $120k  or  $80K-$120K
    { re: /\$\s*(\d+(?:\.\d+)?)\s*[kK]\s*[-–to]+\s*\$?\s*(\d+(?:\.\d+)?)\s*[kK]/, scale: 1000, cur: 'USD' },
    // $80,000 - $120,000
    { re: /\$\s*(\d+)\s*[-–to]+\s*\$?\s*(\d+)/, scale: 1, cur: 'USD' },
    // $100k
    { re: /\$\s*(\d+(?:\.\d+)?)\s*[kK]/, scale: 1000, cur: 'USD', single: true },
    // $100000
    { re: /\$\s*(\d{5,})/, scale: 1, cur: 'USD', single: true },
    // £50k-£80k
    { re: /£\s*(\d+(?:\.\d+)?)\s*[kK]\s*[-–to]+\s*£?\s*(\d+(?:\.\d+)?)\s*[kK]/, scale: 1000, cur: 'GBP' },
    // €60k
    { re: /€\s*(\d+(?:\.\d+)?)\s*[kK]/, scale: 1000, cur: 'EUR', single: true },
  ];

  for (const { re, scale, cur, single } of patterns) {
    const m = s.match(re);
    if (m) {
      const min = Math.round(parseFloat(m[1]) * scale);
      const max = single ? min : Math.round(parseFloat(m[2]) * scale);
      return { min, max, currency: cur, raw: String(raw).trim() };
    }
  }

  // Structured salary_min/max already passed as object
  if (typeof raw === 'object' && raw.min) return raw;
  return { min: null, max: null, currency: 'USD', raw: String(raw).trim() };
}

function formatSalary(salary) {
  if (!salary) return null;
  const fmt = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (salary.currency !== 'USD') {
    const sym = salary.currency === 'GBP' ? '£' : '€';
    if (salary.min && salary.max && salary.min !== salary.max)
      return `${sym}${Math.round(salary.min / 1000)}k–${sym}${Math.round(salary.max / 1000)}k`;
    if (salary.min) return `${sym}${Math.round(salary.min / 1000)}k`;
  }
  if (!salary.min) return salary.raw || null;
  if (salary.min === salary.max) return fmt(salary.min) + '/yr';
  return `${fmt(salary.min)}–${fmt(salary.max)}/yr`;
}

// ── Remotive ─────────────────────────────────────────────────────────────
async function fetchRemotive({ keyword = '', category = '', limit = 30 } = {}) {
  let url = `https://remotive.com/api/remote-jobs?limit=${limit}`;
  if (category) url += `&category=${encodeURIComponent(category)}`;
  if (keyword)  url += `&search=${encodeURIComponent(keyword)}`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Remotive: HTTP ${res.status}`);
  const { jobs } = await res.json();

  return jobs.map((j) => ({
    id:       `remotive_${j.id}`,
    title:    j.title,
    company:  j.company_name,
    location: j.candidate_required_location || 'Worldwide',
    remote:   true,
    salary:   parseSalary(j.salary),
    level:    inferLevel(j.title + ' ' + (j.tags || []).join(' ')),
    tags:     j.tags || [],
    type:     j.job_type || 'Full-time',
    url:      j.url,
    postedAt: new Date(j.publication_date),
    source:   'remotive',
    description: stripHtml(j.description || '').slice(0, 300),
  }));
}

// ── RemoteOK ──────────────────────────────────────────────────────────────
async function fetchRemoteOK({ keyword = '', limit = 30 } = {}) {
  let url = 'https://remoteok.com/api';
  if (keyword) url += `?tag=${encodeURIComponent(keyword.split(' ')[0])}`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`RemoteOK: HTTP ${res.status}`);
  const data = await res.json();

  return data
    .filter((j) => j.position && j.company)   // skip metadata row
    .slice(0, limit)
    .map((j) => ({
      id:       `remoteok_${j.id}`,
      title:    j.position,
      company:  j.company,
      location: j.location || 'Remote',
      remote:   true,
      salary:   j.salary_min
        ? parseSalary({ min: j.salary_min, max: j.salary_max, currency: 'USD' })
        : parseSalary(null),
      level:    inferLevel(j.position + ' ' + (j.tags || []).join(' ')),
      tags:     j.tags || [],
      type:     'Full-time',
      url:      j.apply_url || j.url,
      postedAt: new Date(j.epoch ? j.epoch * 1000 : j.date),
      source:   'remoteok',
      description: stripHtml(j.description || '').slice(0, 300),
    }));
}

// ── Jobicy ────────────────────────────────────────────────────────────────
async function fetchJobicy({ keyword = '', geo = '', count = 30 } = {}) {
  let url = `https://jobicy.com/api/v2/remote-jobs?count=${count}`;
  if (geo)     url += `&geo=${encodeURIComponent(geo)}`;
  if (keyword) url += `&tag=${encodeURIComponent(keyword.split(' ')[0])}`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Jobicy: HTTP ${res.status}`);
  const { jobs } = await res.json();

  return (jobs || []).map((j) => ({
    id:       `jobicy_${j.id}`,
    title:    j.jobTitle,
    company:  j.companyName,
    location: j.jobGeo || 'Remote',
    remote:   true,
    salary:   parseSalary(null),   // Jobicy rarely exposes salary
    level:    mapJobicyLevel(j.jobLevel),
    tags:     Array.isArray(j.jobIndustry) ? j.jobIndustry : [j.jobIndustry].filter(Boolean),
    type:     j.jobType || 'Full-time',
    url:      j.url,
    postedAt: new Date(j.pubDate),
    source:   'jobicy',
    description: stripHtml(j.jobExcerpt || '').slice(0, 300),
  }));
}

// ── Arbeitnow ─────────────────────────────────────────────────────────────
async function fetchArbeitnow({ keyword = '', limit = 30 } = {}) {
  const res = await fetch('https://www.arbeitnow.com/api/job-board-api?page=1', {
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`Arbeitnow: HTTP ${res.status}`);
  const { data } = await res.json();

  let jobs = data || [];
  if (keyword) {
    const kw = keyword.toLowerCase();
    jobs = jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(kw) ||
        (j.description || '').toLowerCase().includes(kw) ||
        (j.tags || []).some((t) => t.toLowerCase().includes(kw))
    );
  }

  return jobs.slice(0, limit).map((j) => ({
    id:       `arbeitnow_${j.slug}`,
    title:    j.title,
    company:  j.company_name,
    location: j.remote ? 'Remote' : (j.location || 'On-site'),
    remote:   Boolean(j.remote),
    salary:   parseSalary(null),
    level:    inferLevel(j.title),
    tags:     j.tags || [],
    type:     (j.job_types || ['Full-time'])[0],
    url:      j.url,
    postedAt: new Date(j.created_at * 1000),
    source:   'arbeitnow',
    description: stripHtml(j.description || '').slice(0, 300),
  }));
}

// ── Instahyre (India-specific) ───────────────────────────────────────────
// Discovered via browser network inspection — unofficial but stable internal API
async function fetchInstahyre({ keyword = '', location = '', years = 0, limit = 30 } = {}) {
  const params = new URLSearchParams({
    skills:       keyword,
    years:        String(years),
    company_size: '0',
    job_type:     '0',
    source:       'opportunities',
  });
  if (location) params.set('locations', location);

  const url = `https://www.instahyre.com/api/v1/job_search?${params}`;
  const res = await fetch(url, {
    headers: {
      ...HEADERS,
      'Accept':  'application/json',
      'Referer': 'https://www.instahyre.com/jobs/',
    },
  });
  if (!res.ok) throw new Error(`Instahyre: HTTP ${res.status}`);
  const data = await res.json();
  const jobs  = data.objects || [];

  return jobs.slice(0, limit).map((j) => ({
    id:       `instahyre_${j.id}`,
    title:    j.title,
    company:  j.employer?.company_name || 'Unknown',
    location: j.locations || 'India',
    remote:   (j.locations || '').toLowerCase().includes('work from home') ||
              (j.locations || '').toLowerCase().includes('remote'),
    salary:   parseSalary(null),   // Instahyre hides salary until match
    level:    inferLevel(j.title + ' ' + (j.candidate_title || '')),
    tags:     (j.keywords || []).map((k) => k.name || k).filter(Boolean),
    type:     'Full-time',
    url:      j.public_url || `https://www.instahyre.com${j.resource_uri || ''}`,
    postedAt: j.reviewed_at ? new Date(j.reviewed_at) : new Date(),
    source:   'instahyre',
    description: j.employer?.instahyre_note
      ? stripHtml(j.employer.instahyre_note).slice(0, 300)
      : `${j.employer?.company_tagline || ''}`,
  }));
}

// ── LeetCode Discuss (job/hiring threads) ─────────────────────────────────
// Uses LeetCode's public GraphQL API — no auth required
async function fetchLeetCodeJobs({ keyword = '', limit = 20 } = {}) {
  const query = `query categoryTopicList($categories: [String!]!, $first: Int!, $orderBy: TopicSortingOption, $skip: Int, $query: String, $tags: [String!]!) {
    categoryTopicList(categories: $categories, first: $first, orderBy: $orderBy, skip: $skip, query: $query, tags: $tags) {
      totalNum
      edges { node { id title viewCount commentCount post { creationDate author { username } } } }
    }
  }`;

  const searchQuery = keyword
    ? `${keyword} hiring job`
    : 'hiring job backend software engineer';

  const res = await fetch('https://leetcode.com/graphql/', {
    method:  'POST',
    headers: {
      ...HEADERS,
      'Content-Type': 'application/json',
      'Referer': 'https://leetcode.com/discuss/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    body: JSON.stringify({
      query,
      variables: {
        categories: ['interview-question'],
        first:      limit,
        orderBy:    'newest_to_oldest',
        skip:       0,
        query:      searchQuery,
        tags:       [],
      },
    }),
  });

  if (!res.ok) throw new Error(`LeetCode: HTTP ${res.status}`);
  const { data, errors } = await res.json();
  if (errors) throw new Error(`LeetCode GraphQL: ${errors[0]?.message}`);

  const edges = data?.categoryTopicList?.edges || [];

  return edges.map((e) => ({
    id:       `leetcode_${e.node.id}`,
    title:    e.node.title,
    company:  'LeetCode Discuss',
    location: 'Community Discussion',
    remote:   true,
    salary:   parseSalary(null),
    level:    inferLevel(e.node.title),
    tags:     ['discussion', 'community', 'interview'],
    type:     'Discussion',
    url:      `https://leetcode.com/discuss/interview-question/${e.node.id}`,
    postedAt: new Date((e.node.post?.creationDate || 0) * 1000),
    source:   'leetcode',
    description: `👁 ${e.node.viewCount} views · 💬 ${e.node.commentCount} comments · by ${e.node.post?.author?.username || 'Anonymous'}`,
  }));
}

// ── Fan-out ───────────────────────────────────────────────────────────────
async function fetchAll(opts = {}) {
  const {
    sources  = ['remotive', 'remoteok', 'jobicy', 'arbeitnow'],
    keyword  = '',
    limit    = 20,
    location = '',
    years    = 0,
  } = opts;

  const fetchers = {
    remotive:   () => fetchRemotive({ keyword, limit }),
    remoteok:   () => fetchRemoteOK({ keyword, limit }),
    jobicy:     () => fetchJobicy({ keyword, count: limit }),
    arbeitnow:  () => fetchArbeitnow({ keyword, limit }),
    instahyre:  () => fetchInstahyre({ keyword, location, years, limit }),
    leetcode:   () => fetchLeetCodeJobs({ keyword, limit }),
  };

  const enabled = sources.filter((s) => fetchers[s]);
  const results = await Promise.allSettled(enabled.map((s) => fetchers[s]()));

  const items = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value);
    else console.error(`  ⚠  ${enabled[i]}: ${r.reason?.message || 'failed'}`);
  });
  return items;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '')
    .replace(/\s{2,}/g, ' ').trim();
}

function inferLevel(text) {
  const t = text.toLowerCase();
  if (/\b(staff|principal|vp|director|head of|cto|ceo)\b/.test(t)) return 'staff';
  if (/\b(senior|sr\.?|lead|architect)\b/.test(t)) return 'senior';
  if (/\b(mid|middle|intermediate|associate)\b/.test(t)) return 'mid';
  if (/\b(junior|jr\.?|entry|intern|graduate|fresh|trainee)\b/.test(t)) return 'junior';
  return 'any';
}

function mapJobicyLevel(raw = '') {
  const t = raw.toLowerCase();
  if (t.includes('senior')) return 'senior';
  if (t.includes('mid'))    return 'mid';
  if (t.includes('junior')) return 'junior';
  if (t.includes('intern')) return 'junior';
  return 'any';
}

module.exports = {
  fetchAll,
  fetchRemotive, fetchRemoteOK, fetchJobicy, fetchArbeitnow,
  fetchInstahyre, fetchLeetCodeJobs,
  parseSalary, formatSalary, inferLevel, stripHtml,
};
