MIM-CHATBOT — QUELLENPAKET
===========================

Dieses Paket enthält alles, was du brauchst, um am MIM-Chatbot
für das AI Capstone Project SS2026 weiterzuarbeiten.

INHALT:
-------
1. index.html
   Der aktuelle Chatbot in einer einzigen Datei. Offline-Version
   ohne externe APIs. Liest MP3-Dateien aus dem audio/-Ordner und
   fällt auf Browser-Sprachausgabe zurück, wenn Audios fehlen.

2. audio-texte.md
   Die 16 Texte, aus denen die Volz-Stimme-MP3s gerendert werden.
   Reihenfolge und Dateinamen sind verbindlich, sonst findet der
   Chatbot die Audios nicht.

3. volz-stimme.mp4
   Original-Sprachprobe von Prof. Dr. Raphael Volz. Diese Datei
   dient als Voice-Reference fuer den ComfyUI-Workflow
   (Option 2: Instant Voice Clone).

4. MODULHANDBUCH_MASTER_MIM_PO_2024.pdf
   Offizielles Modulhandbuch der Hochschule Pforzheim, Stand
   01.09.2024. Die Wissensbasis im Chatbot stammt aus diesem
   Dokument plus Kursunterlagen SS26 / WS25-26.

WAS NOCH FEHLT (separat besorgen):
----------------------------------
- ComfyUI mit ElevenLabs-Nodes installiert
- ElevenLabs-API-Key (Free-Tier-Credits reichen fuer alle 16 Audios)
- Den ComfyUI-Workflow vom Prof (api_elevenlabs_text_to_...json)

DEPLOYMENT:
-----------
Der Code ist auf GitHub im Repo "olista01/mim-chatbot" und auf
Vercel ueber das Team "baldidercoders-projects" verknuepft.
Updates per Push auf main → automatischer Re-Deploy.

KONTAKT BEI FRAGEN:
-------------------
Oli (olista01)
