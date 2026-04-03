// lib/dedup.js — Title-based deduplication using trigram Jaccard similarity

/**
 * Generate all character trigrams from a normalised title string.
 * e.g. "hello" → {"hel","ell","llo"}
 */
function getTrigrams(text) {
  const norm = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const trigrams = new Set();
  for (let i = 0; i <= norm.length - 3; i++) {
    trigrams.add(norm.slice(i, i + 3));
  }
  return trigrams;
}

/**
 * Jaccard similarity: |A ∩ B| / |A ∪ B|
 * Returns 0–1. 1 = identical, 0 = no overlap.
 */
function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionCount = 0;
  for (const t of setA) {
    if (setB.has(t)) intersectionCount++;
  }
  const unionSize = setA.size + setB.size - intersectionCount;
  return intersectionCount / unionSize;
}

/**
 * Remove near-duplicate stories (same story from different sources).
 * When two items exceed `threshold` similarity, keep the one with the higher score.
 *
 * @param {object[]} items  - normalised story objects
 * @param {number}   threshold - Jaccard similarity threshold (0–1), default 0.55
 * @returns {object[]} deduplicated list
 */
function deduplicate(items, threshold = 0.55) {
  // Pre-compute trigrams for each item
  const tagged = items.map((item) => ({
    item,
    trigrams: getTrigrams(item.title),
    keep: true,
  }));

  for (let i = 0; i < tagged.length; i++) {
    if (!tagged[i].keep) continue;

    for (let j = i + 1; j < tagged.length; j++) {
      if (!tagged[j].keep) continue;

      const sim = jaccardSimilarity(tagged[i].trigrams, tagged[j].trigrams);

      if (sim >= threshold) {
        // Keep higher-scored item; drop lower
        if (tagged[j].item.score > tagged[i].item.score) {
          tagged[i].keep = false;
          break; // i is eliminated — no need to compare further
        } else {
          tagged[j].keep = false;
        }
      }
    }
  }

  return tagged.filter((t) => t.keep).map((t) => t.item);
}

/**
 * Compute similarity stats — useful for debugging.
 */
function similarityReport(items, threshold = 0.55) {
  const pairs = [];
  const trigrams = items.map((i) => getTrigrams(i.title));

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sim = jaccardSimilarity(trigrams[i], trigrams[j]);
      if (sim >= threshold) {
        pairs.push({
          similarity: parseFloat(sim.toFixed(3)),
          a: items[i].title,
          b: items[j].title,
          aSource: items[i].source,
          bSource: items[j].source,
        });
      }
    }
  }
  return pairs.sort((a, b) => b.similarity - a.similarity);
}

module.exports = { deduplicate, similarityReport, jaccardSimilarity, getTrigrams };
