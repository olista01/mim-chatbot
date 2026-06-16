// BM25-Suche ueber den von scripts/build_search_index.js erzeugten Index.
// Laedt chunks.json + bm25-index.json einmal pro Funktions-Instanz (warm
// reuse zwischen Requests) und bewertet Chunks anhand der Query.

const fs = require("fs");
const path = require("path");

const chunks = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "chunks.json"), "utf-8")
);
const { invertedIndex, docLengths, avgdl, n } = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "bm25-index.json"), "utf-8")
);

const K1 = 1.5;
const B = 0.75;

const STOPWORDS = new Set(
  (
    "der die das den dem des ein eine einer eines einem einen und oder " +
    "ist sind war waren wird werden wurde wurden hat haben hatte hatten " +
    "nicht kein keine mit von zu zum zur im in an auf fuer für als auch " +
    "im am bei nach vor ueber über unter zwischen sich sie er es wir ihr " +
    "ich du man man dass wenn weil da so wie was wer wo wann ob aber doch " +
    "noch nur schon also dann mehr sehr alle alles jede jeder jedes " +
    "diese dieser dieses dem den des unserer unseren ihre ihren ihrem " +
    "the and or is are was were has have had not this that with for to " +
    "of in on at by from as an be it its"
  ).split(/\s+/)
);

function tokenize(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9äöüß\s]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// idf wird pro Anfrage fuer die jeweiligen Query-Terme berechnet
// (kein Caching nötig, Query hat nur wenige eindeutige Terme).
function idf(term) {
  const postings = invertedIndex[term];
  const df = postings ? postings.length : 0;
  return Math.log(1 + (n - df + 0.5) / (df + 0.5));
}

function search(query, topK = 5) {
  const queryTerms = [...new Set(tokenize(query))];
  const scores = new Map(); // chunkIdx -> score

  for (const term of queryTerms) {
    const postings = invertedIndex[term];
    if (!postings) continue;
    const termIdf = idf(term);

    for (const [chunkIdx, tf] of postings) {
      const dl = docLengths[chunkIdx];
      const denom = tf + K1 * (1 - B + (B * dl) / avgdl);
      const score = termIdf * ((tf * (K1 + 1)) / denom);
      scores.set(chunkIdx, (scores.get(chunkIdx) || 0) + score);
    }
  }

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([idx, score]) => ({ ...chunks[idx], score }));

  return ranked;
}

module.exports = { search };
