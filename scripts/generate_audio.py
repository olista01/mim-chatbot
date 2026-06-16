"""
Generiert die 16 Volz-Stimme-MP3s aus audio-texte.md mit Coqui XTTS-v2
(lokales, kostenloses Voice-Cloning-Modell). Referenzaudio: volz-stimme.mp4.

Lauft komplett lokal auf der CPU -- keine Cloud-API, keine Kosten,
kein API-Key noetig. Dauert je nach Rechner ca. 1-2 Minuten pro Audio.

Aufruf:
    python scripts/generate_audio.py
"""
import os
import re
import subprocess
from pathlib import Path

os.environ.setdefault("COQUI_TOS_AGREED", "1")  # CPML: nur nicht-kommerzielle Nutzung, s. SETUP.md

import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent.parent
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
REF_VIDEO = ROOT / "volz-stimme.mp4"
TEXTS_MD = ROOT / "audio-texte.md"
OUT_DIR = ROOT / "audio"
TMP_REF_WAV = ROOT / "scripts" / "_volz_ref.wav"

ENTRY_RE = re.compile(r"## audio/(\S+\.mp3)\s*\n\s*> (.+)")


def extract_reference_audio():
    print("[1/3] Extrahiere Referenz-Audio aus volz-stimme.mp4 ...")
    subprocess.run(
        [FFMPEG, "-y", "-i", str(REF_VIDEO), "-vn", "-ac", "1", "-ar", "22050",
         "-t", "30", str(TMP_REF_WAV)],
        check=True, capture_output=True,
    )


def parse_entries():
    text = TEXTS_MD.read_text(encoding="utf-8")
    return ENTRY_RE.findall(text)


def main():
    OUT_DIR.mkdir(exist_ok=True)
    extract_reference_audio()

    entries = parse_entries()
    print(f"[2/3] {len(entries)} Texte gefunden. Lade XTTS-v2 (laedt beim ersten Mal "
          f"ein ~1.8 GB Modell herunter) ...")

    from TTS.api import TTS
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")

    for i, (filename, sentence) in enumerate(entries, 1):
        out_wav = OUT_DIR / filename.replace(".mp3", ".wav")
        out_mp3 = OUT_DIR / filename
        print(f"[3/3] ({i}/{len(entries)}) {filename}")
        tts.tts_to_file(text=sentence, speaker_wav=str(TMP_REF_WAV),
                         language="de", file_path=str(out_wav))
        subprocess.run(
            [FFMPEG, "-y", "-i", str(out_wav), "-codec:a", "libmp3lame",
             "-qscale:a", "2", str(out_mp3)],
            check=True, capture_output=True,
        )
        out_wav.unlink()

    TMP_REF_WAV.unlink(missing_ok=True)
    print(f"\nFertig. {len(entries)} MP3s liegen in {OUT_DIR}/")


if __name__ == "__main__":
    main()
