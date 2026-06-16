# MIM Chatbot — Hochschule Pforzheim

Chatbot in der Persona von Prof. Dr. Raphael Volz für den Master Industrial
Management (MIM) der Hochschule Pforzheim. Entstanden im Rahmen des AI
Capstone Project SS2026.

**Live:** über Vercel (Team `baldidercoders-projects`), automatisches Deploy
bei jedem Push auf `main`.

---

## Wie der Chatbot antwortet

Es gibt zwei Antwortpfade, je nachdem wie die Frage gestellt wird:

1. **Klick auf einen Themen-Chip** (Sidebar → „Themen schnell fragen") →
   feste, vorformulierte Antwort aus dem `QA`-Array in `index.html`, dazu
   eine **vorgerenderte MP3 mit Volz' geklonter Stimme** aus `audio/`.
2. **Frei eingetippte Frage** → geht an `/api/chat` (Vercel-Funktion):
   - sucht per BM25 die 5 relevantesten Textstellen aus dem kompletten
     HSPF-Website-Crawl (`api/search.js` + `api/data/*.json`)
   - baut daraus zusammen mit der fest hinterlegten Kern-Wissensbasis
     (`api/knowledge.js`) einen System-Prompt
   - schickt das an **Groq** (`llama-3.3-70b-versatile`, kostenlos, kein
     Kartendaten-Setup nötig)
   - die Antwort kommt **ohne** vorgerenderte Volz-Audiodatei zurück und
     wird stattdessen über die Browser-Sprachausgabe vorgelesen
   - Badge in der UI unterscheidet die Quelle: „Aus Wissensbasis" (Chip),
     „KI-generiert" (blau, `/api/chat`), „Außerhalb Wissensbasis" (Fallback
     bei API-Fehler)

**Wichtig:** Damit Pfad 2 funktioniert, muss in Vercel die Umgebungsvariable
`GROQ_API_KEY` gesetzt sein (Project Settings → Environment Variables).
Ohne Key liefert `/api/chat` einen 500er und die UI fällt automatisch auf
die statische Standard-Ausweichantwort zurück — die Seite bricht also nicht,
aber freie Fragen werden dann nicht beantwortet.

---

## Architektur

Statisches Frontend (`index.html`, kein Build-Schritt, kein Framework) +
zwei kleine Vercel-Serverless-Functions unter `api/`. Niemand, der die Seite
besucht, braucht irgendeine Installation — alles unten unter „Lokale
Entwicklung" betrifft nur das **Erweitern** des Projekts, nicht den Betrieb.

```
index.html              Komplettes Frontend: Markup, CSS, JS (Sidebar,
                         Chat-Fenster, Audio-Wiedergabe, Chat-Historie)
api/
  chat.js                Vercel-Function: nimmt Frage entgegen, holt BM25-
                          Kontext, ruft Groq auf, gibt Antwort zurueck
  knowledge.js            Fest eingebettete Kern-Wissensbasis (String) fuer
                          den System-Prompt — bewusst nicht per fs gelesen,
                          damit Vercel sie beim Bundling sicher mitnimmt
  search.js                BM25-Suche ueber api/data/*.json (lazy-loaded,
                          bleibt zwischen Requests im warmen Function-
                          Instance-Speicher)
  data/
    chunks.json             ~14 MB, alle Text-Chunks aus dem Website-Crawl
    bm25-index.json          ~9 MB, invertierter Index dazu
scripts/
  build_search_index.js   Baut chunks.json + bm25-index.json neu aus dem
                          rohen Crawl-Dataset (siehe unten)
  generate_audio.py       Erzeugt die 16 Volz-Stimme-MP3s lokal per Coqui
                          XTTS-v2 (siehe SETUP.md)
audio/
  *.mp3 (16 Dateien)      Vorgerenderte Antworten in Volz' geklonter Stimme
audio-texte.md             Die 16 Texte, aus denen die MP3s gerendert werden
                          (Reihenfolge/Dateinamen sind verbindlich)
volz-stimme.mp4             Original-Sprachprobe als Voice-Reference fuer
                          die Klonung
industrial_management_hspf_wissensbasis.md
                         Recherchierte Kern-Fakten zum Studiengang (Quelle
                         fuer api/knowledge.js, von Hand kuratiert)
MODULHANDBUCH_MASTER_MIM_PO_2024.pdf
Sommersemester2026.pdf, 1NEU_Wintersemester2026_27.pdf,
1Neu_Sommersemester_2027.pdf, Wintersemester2027_28.pdf
                         Offizielle HSPF-Dokumente (Modulhandbuch,
                         Semestertermine) als Referenz/Beleg fuer die
                         Wissensbasis
dataset_website-content-crawler_2026-06-16_16-20-48-422.json
                         Rohes Crawl-Ergebnis der gesamten hs-pforzheim.de
                         (~2800 Seiten, ~11 MB) — Eingabe fuer
                         build_search_index.js
Unbenannt.png            Offizielles HSPF-Logo (noch nicht ins UI
                         eingebaut, siehe TODOs)
SETUP.md                 Anleitung zum lokalen Erzeugen neuer Volz-Audios
```

---

## UI-Aufbau (`index.html`)

Bewusst **kein** generischer Chat-Bubble-Look — stattdessen ein
editoriales Interview-Transkript-Layout (helle Papier-Optik, Crimson Pro
für Antworten, Atkinson Hyperlegible für UI-Text), nach Diagnose über das
`ui-ux-pro-max`-Skill, dass Dark-Mode/Glow-Chatbubbles für einen
akademischen Kontext selbst zum KI-Klischee geworden sind.

- **Sidebar links:** Chat-Verlauf (mehrere Unterhaltungen, lokal in
  `localStorage` unter `mim_chats_v1`/`mim_active_chat_v1`), darunter
  aufklappbare Quick-Infos (Studienverlauf-Tabelle, Bewerbungsfristen,
  Kontakte) und die Themen-Chips
- **Hauptbereich:** Hero-Zeile + Chat-Fenster (eigene Scroll-Box, sichtbar
  umrahmt) + Eingabefeld
- Echte HSPF-Markenfarben (`#FFBE31` Gold, `#1934FF` Blau) — verifiziert
  direkt aus dem Live-CSS von hs-pforzheim.de, nicht erfunden
- Sprachausgabe: Button oben rechts toggelt `audioOn` (localStorage),
  spielt MP3 ab oder fällt auf `SpeechSynthesisUtterance` zurück

---

## Lokale Entwicklung

### Wissensbasis erweitern (ohne Code-Aenderung an der Suche)

Neue Fakten kommen in `api/knowledge.js` (fest eingebetteter String) oder,
falls sie zu einer der 16 festen Chip-Antworten gehören, als neuer Eintrag
ins `QA`-Array in `index.html` (plus passender Abschnitt in
`audio-texte.md`, falls eine eigene Audio gewünscht ist).

### Suchindex neu bauen (wenn sich der Website-Crawl ändert)

```bash
node scripts/build_search_index.js
```

Liest die `dataset_website-content-crawler_*.json`, zerteilt jede Seite in
~800-Zeichen-Chunks und schreibt `api/data/chunks.json` +
`api/data/bm25-index.json` neu. Bei einem neuen Crawl-Export zuerst den
`DATASET_PATH` in `scripts/build_search_index.js` anpassen.

### Neue Volz-Audios erzeugen

Siehe `SETUP.md` — läuft lokal und kostenlos über Coqui XTTS-v2, betrifft
nur die Audiodateien, nicht den Betrieb der Seite.

### Vercel-Umgebungsvariablen

| Name | Zweck | Wo setzen |
|---|---|---|
| `GROQ_API_KEY` | Auth für `/api/chat` → Groq | Vercel Project Settings → Environment Variables |

---

## Offene TODOs

- [ ] HSPF-Logo (`Unbenannt.png`) ins Header/UI einbauen (aktuell nur als
      schwaches Wasserzeichen im Hero-Bereich aus dem SVG-Pfad, nicht die
      PNG-Datei selbst)
- [ ] `GROQ_API_KEY` in Vercel prüfen/setzen, falls noch nicht geschehen
- [ ] Live testen: tippt man eine Frage außerhalb der 16 Chip-Themen,
      kommt eine sinnvolle, auf den Website-Auszügen basierende Antwort?
- [ ] Ggf. weitere Themen-Chips ergänzen, falls in den Quick-Infos noch
      Lücken auffallen