module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const text = (req.body && req.body.text ? String(req.body.text) : "").trim();
  if (!text) { res.status(400).json({ error: "Missing text" }); return; }
  if (text.length > 1000) { res.status(400).json({ error: "Text too long" }); return; }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    res.status(500).json({ error: "TTS not configured" });
    return;
  }
  try {
    const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.85,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });
    if (!elRes.ok) {
      const err = await elRes.text();
      console.error("ElevenLabs error:", elRes.status, err);
      res.status(502).json({ error: "TTS upstream error" });
      return;
    }
    const audioBuffer = await elRes.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error("TTS handler error:", err);
    res.status(500).send(Buffer.from(""));
  }
};
