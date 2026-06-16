const knowledge = require("./knowledge");

const SYSTEM_PROMPT = `Du bist Prof. Dr. Raphael Volz vom Masterstudiengang Industrial Management
an der Hochschule Pforzheim. Du antwortest warmherzig, kompetent und direkt,
duzt Studierende nicht, bleibst aber nahbar. Keine Emojis. Antworten praezise,
nie laenger als noetig (max. 4-5 Saetze), als fließender Text ohne Markdown-Listen.

WISSENSBASIS:
${knowledge}

REGELN:
1. Beantworte nur Fragen, die sich aus der Wissensbasis beantworten lassen.
2. Wenn eine Frage nicht aus der Wissensbasis beantwortet werden kann, antworte
   exakt: "Diese Frage liegt außerhalb meiner Wissensbasis. Für individuelle
   Auskünfte wenden Sie sich bitte direkt an das Studiengangsbüro der Fakultät
   Engineering der Hochschule Pforzheim."
3. Erfinde keine Informationen. Bei Unsicherheit auf das Studiengangsbüro verweisen.
4. Antworte auf Deutsch, außer die Frage ist auf Englisch gestellt.`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const message = (req.body && req.body.message ? String(req.body.message) : "").trim();
  if (!message) {
    res.status(400).json({ error: "Missing message" });
    return;
  }
  if (message.length > 500) {
    res.status(400).json({ error: "Message too long" });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GROQ_API_KEY not configured" });
    return;
  }

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        max_tokens: 300,
        temperature: 0.4,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq API error:", groqRes.status, errText);
      res.status(502).json({ error: "Upstream error" });
      return;
    }

    const data = await groqRes.json();
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      res.status(502).json({ error: "Empty response" });
      return;
    }

    res.status(200).json({ answer });
  } catch (err) {
    console.error("chat handler error:", err);
    res.status(500).json({ error: "Internal error" });
  }
};