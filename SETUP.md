# Setup-Anleitung für Mitentwickler (und deren Claude)

Diese Datei ist dafür gedacht, dass ein Claude-Assistent sie liest und
direkt weiß, was zu tun ist, um an diesem Projekt weiterzuarbeiten.

## Was dieses Projekt ist

Ein Chatbot in der Stimme von Prof. Dr. Raphael Volz für den Master
Industrial Management an der Hochschule Pforzheim (AI Capstone Project
SS2026). Es ist eine **einzige statische `index.html`**-Datei ohne
Build-Schritt, ohne Backend, ohne Server.

- Wissensbasis: fest verdrahtetes Array `QA` in `index.html` (Keyword-Matching,
  keine echte KI/kein LLM-Call zur Laufzeit)
- Zusatzquellen zum Erweitern der Wissensbasis: `industrial_management_hspf_wissensbasis.md`,
  `MODULHANDBUCH_MASTER_MIM_PO_2024.pdf`
- Sprachausgabe: spielt vorgerenderte MP3s aus `audio/` ab, fällt sonst auf
  Browser-TTS zurück

## Wichtig: Deployment auf Vercel ist komplett unabhängig von diesem Setup

Die Website läuft auf Vercel als **rein statisches Hosting** der `index.html`
plus der `audio/*.mp3`-Dateien. Niemand, der die Seite besucht, braucht
Python, Coqui-TTS, einen API-Key oder irgendeine Installation — das hier
betrifft ausschließlich das **Erzeugen neuer Audiodateien**, nicht den
Betrieb der Seite. Sobald die MP3s einmal im Repo liegen und gepusht sind,
deployed Vercel automatisch und alle Besucher hören sie einfach ab.

→ Falls keine neuen Audios gebraucht werden, ist **gar keine Installation
nötig** — einfach `index.html` direkt bearbeiten und pushen.

## Installation (nur nötig, um neue Volz-Audios zu erzeugen)

Stimmklonung läuft lokal und kostenlos über **Coqui XTTS-v2** (kein Abo,
kein API-Key). Voraussetzung: Python 3.10–3.14, ca. 3–4 GB freier
Speicherplatz (Modell + Abhängigkeiten).

**Lizenzhinweis:** XTTS-v2 steht unter der Coqui Public Model License
(CPML) — nur für **nicht-kommerzielle Nutzung** erlaubt. Für dieses
Uni-Projekt (AI Capstone Project) ist das unproblematisch. Beim ersten
Lauf von `generate_audio.py` muss diese Lizenz akzeptiert werden; das
Skript setzt dafür automatisch `COQUI_TOS_AGREED=1` (s.u.), alternativ
selbst setzen:

```bash
python -m pip install "torch" "torchaudio" "coqui-tts[codec]" imageio-ffmpeg
# transformers-Version pinnen (neuere Versionen brechen XTTS-v2 aktuell):
python -m pip install "transformers==4.57.1"
```

Danach Audios generieren:

```bash
python scripts/generate_audio.py
```

Das Skript:
1. Extrahiert die ersten 30s Ton aus `volz-stimme.mp4` als Sprachreferenz
2. Liest die 16 Texte aus `audio-texte.md`
3. Lädt beim ersten Lauf einmalig das XTTS-v2-Modell (~1.8 GB, danach
   gecacht)
4. Rendert jeden Text mit der geklonten Volz-Stimme nach `audio/<name>.mp3`

Läuft auf CPU, dauert ca. 1–2 Minuten pro Audio (16 Stück ≈ 20–30 Minuten).
Mit GPU (CUDA) deutlich schneller.

## Danach

```bash
git add audio/
git commit -m "Add Volz voice-cloned audio files"
git push
```

Vercel deployed automatisch. Fertig — alle Besucher hören jetzt die
geklonte Stimme statt Browser-TTS.

## Wissensbasis erweitern

Neue Themen kommen als zusätzliche Einträge ins `QA`-Array in `index.html`
(`id`, `keywords`, optional `chip`, `answer`, `audio`-Pfad). Für neue
Audios dafür `audio-texte.md` um den passenden Abschnitt
(`## audio/<name>.mp3` + `> <Text>`) ergänzen und das Skript erneut laufen
lassen.
