// Baut einen BM25-Suchindex aus dem Apify-Website-Crawl-Dataset UND
// den lokalen PDF-Dateien (Modulhandbuch, Semestertermine).
// Zerteilt alles in Chunks, tokenisiert und schreibt api/data/*.json.
//
// Aufruf: node scripts/build_search_index.js

const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse"); // v1.x: direkt eine Funktion

const ROOT = path.join(__dirname, "..");
const DATASET_PATH = path.join(
  ROOT,
  "dataset_website-content-crawler_2026-06-16_16-20-48-422.json"
);
const OUT_DIR = path.join(ROOT, "api", "data");
const CHUNKS_OUT = path.join(OUT_DIR, "chunks.json");
const INDEX_OUT = path.join(OUT_DIR, "bm25-index.json");

// Alle PDFs im Projekt-Root, die indexiert werden sollen
const PDF_FILES = [
  "MODULHANDBUCH_MASTER_MIM_PO_2024.pdf",
  "Sommersemester2026.pdf",
  "1NEU_Wintersemester2026_27.pdf",
  "1Neu_Sommersemester_2027.pdf",
  "Wintersemester2027_28.pdf",
];

const CHUNK_SIZE = 800; // Zielgroesse in Zeichen
const CHUNK_OVERLAP = 120;

// Zeilen, die auf nahezu jeder Seite als Navigations-/Cookie-Rauschen
// auftauchen und keinen inhaltlichen Mehrwert haben.
const JUNK_LINES = new Set([
  "SCHLIESSEN",
  "CLOSE",
  "Deutschland",
  "75175 Pforzheim",
  "Tiefenbronner Straße 65",
  "Tiefenbronner Str. 65",
]);

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

function loadDataset() {
  const raw = fs.readFileSync(DATASET_PATH, "utf-8");
  return JSON.parse(raw);
}

function cleanText(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !JUNK_LINES.has(l))
    .join("\n");
}

// Zerteilt Text in ueberlappende Chunks, bevorzugt an Absatzgrenzen.
function chunkText(text) {
  const paragraphs = text.split("\n").filter((p) => p.trim().length > 0);
  const chunks = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 1 > CHUNK_SIZE && current.length > 0) {
      chunks.push(current);
      // Overlap: letzte CHUNK_OVERLAP Zeichen des vorigen Chunks mitnehmen
      current = current.slice(-CHUNK_OVERLAP) + "\n" + para;
    } else {
      current = current ? current + "\n" + para : para;
    }
  }
  if (current.trim().length > 0) chunks.push(current);
  return chunks;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // Diakritika entfernen fuer robusteres Matching
    .replace(/[^a-z0-9äöüß\s]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

async function loadPdfs() {
  const pdfChunks = [];
  for (const filename of PDF_FILES) {
    const filePath = path.join(ROOT, filename);
    if (!fs.existsSync(filePath)) {
      console.warn("PDF nicht gefunden, übersprungen:", filename);
      continue;
    }
    try {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer, { max: 0 }); // max:0 = alle Seiten
      const cleaned = cleanText(data.text);
      if (cleaned.length < 30) continue;
      const source = `pdf://${filename}`;
      for (const c of chunkText(cleaned)) {
        if (c.trim().length < 30) continue;
        pdfChunks.push({ url: source, text: c.trim() });
      }
      console.log(`  ${filename}: ${pdfChunks.filter(c => c.url === source).length} Chunks`);
    } catch (err) {
      console.error("Fehler beim Lesen von", filename, err.message);
    }
  }
  return pdfChunks;
}

async function build() {
  console.log("Lade Dataset von", DATASET_PATH);
  const pages = loadDataset();
  console.log("Seiten im Dataset:", pages.length);

  const chunks = []; // { url, text }
  for (const page of pages) {
    if (!page.text || !page.text.trim()) continue;
    const cleaned = cleanText(page.text);
    if (cleaned.length < 30) continue;
    for (const c of chunkText(cleaned)) {
      if (c.trim().length < 30) continue;
      chunks.push({ url: page.url, text: c.trim() });
    }
  }
  console.log("Web-Crawl Chunks:", chunks.length);

  console.log("\nVerarbeite PDFs...");
  const pdfChunks = await loadPdfs();
  chunks.push(...pdfChunks);
  console.log("PDF Chunks gesamt:", pdfChunks.length);
  console.log("Alle Chunks gesamt:", chunks.length);

  // Inverted Index: term -> [[chunkIdx, termFreq], ...]
  const invertedIndex = {};
  const docLengths = new Array(chunks.length);
  let totalLength = 0;

  chunks.forEach((chunk, idx) => {
    const tokens = tokenize(chunk.text);
    docLengths[idx] = tokens.length;
    totalLength += tokens.length;

    const tf = {};
    for (const t of tokens) tf[t] = (tf[t] || 0) + 1;

    for (const [term, freq] of Object.entries(tf)) {
      if (!invertedIndex[term]) invertedIndex[term] = [];
      invertedIndex[term].push([idx, freq]);
    }
  });

  const avgdl = totalLength / chunks.length;
  console.log("Eindeutige Terme:", Object.keys(invertedIndex).length);
  console.log("Durchschnittliche Chunk-Laenge (Tokens):", avgdl.toFixed(1));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    CHUNKS_OUT,
    JSON.stringify(chunks.map((c) => ({ url: c.url, text: c.text })))
  );
  fs.writeFileSync(
    INDEX_OUT,
    JSON.stringify({
      invertedIndex,
      docLengths,
      avgdl,
      n: chunks.length,
    })
  );

  console.log("Geschrieben:", CHUNKS_OUT);
  console.log("Geschrieben:", INDEX_OUT);
}

build().catch(err => { console.error(err); process.exit(1); });