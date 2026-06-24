const knowledge = require("./knowledge");
const { search } = require("./search");

const MIN_RELEVANCE_SCORE = 1.5;

function buildSystemPrompt(message) {
  const hits = search(message, 5).filter((h) => h.score >= MIN_RELEVANCE_SCORE);
  const excerpts = hits
    .map((h, i) => `[${i + 1}] (${h.url})\n${h.text}`)
    .join("\n\n");

  return `You are Mimstein, an AI assistant for the Master's programme Industrial
Management at Pforzheim University. Reply warmly, competently and directly,
addressing students formally (no first-name basis) while staying approachable.
No emojis.

FORMATTING RULES:
- For a single, clearly answerable question: 2-4 sentences of flowing prose.
- For several points or enumerations (e.g. deadlines, steps, options):
  use a short bullet list with "- " at the start of each line.
- Highlight important dates, deadlines and proper names with **bold text**.
- Never longer than necessary. No Markdown headings, no nested lists.

KNOWLEDGE BASE (core information about the programme):
${knowledge}

${excerpts ? `WEBSITE EXCERPTS (automatically selected to fit the question, from hs-pforzheim.de):\n${excerpts}\n` : ""}
RULES:
1. Answer questions only on the basis of the KNOWLEDGE BASE and the WEBSITE
   EXCERPTS above.
2. If the answer is not contained there, reply with exactly this text: "This
   question is outside my knowledge base. For individual enquiries please
   contact the programme office of the School of Engineering at Pforzheim
   University directly."
3. The website excerpts may also concern other programmes or general university
   topics (admission, re-registration, deadlines, exchange semester, etc.).
   Use them where they fit the question, but do not flag them explicitly
   ("according to excerpt X"); answer as if from your own knowledge.
4. Do not invent information that is not in the KNOWLEDGE BASE or the
   excerpts. When in doubt, refer the user to the programme office.
5. Reply in English by default. If the user clearly writes in German, you may
   reply in German.`;
}

function getSourceUrls(message) {
  const hits = search(message, 5).filter((h) => h.score >= MIN_RELEVANCE_SCORE);
  return [...new Set(hits.map((h) => h.url))].slice(0, 3);
}

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
          { role: "system", content: buildSystemPrompt(message) },
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

    const sources = getSourceUrls(message);
    res.status(200).json({ answer, sources });
  } catch (err) {
    console.error("chat handler error:", err);
    res.status(500).json({ error: "Internal error" });
  }
};
