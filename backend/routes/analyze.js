const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are a sales call quality analyst for Next Level Systems, which sells an ADHD life optimizer service.
Score the call on these 5 criteria (0-10 each):
1. Discovery & ADHD pain identification
2. Objection handling
3. Program clarity & value articulation
4. Urgency & close execution
5. Rapport & trust building

Return ONLY valid JSON with no markdown or extra text, in this exact shape:
{
  "overall": <number 0-100>,
  "criteria": [
    { "name": "Discovery & ADHD pain ID", "score": <0-10> },
    { "name": "Objection handling", "score": <0-10> },
    { "name": "Program clarity", "score": <0-10> },
    { "name": "Urgency & close", "score": <0-10> },
    { "name": "Rapport & trust", "score": <0-10> }
  ],
  "strengths": "<string>",
  "improvements": "<string>",
  "script_suggestion": "<string>"
}`;

router.post('/', async (req, res) => {
  const { rep, outcome, transcript } = req.body;

  if (!rep || !outcome || !transcript) {
    return res.status(400).json({ error: 'rep, outcome, and transcript are required' });
  }

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Rep: ${rep}\nOutcome: ${outcome}\n\nTranscript:\n${transcript}`,
        },
      ],
    });

    const scored = JSON.parse(message.content[0].text);
    res.json(scored);
  } catch (err) {
    console.error('analyze error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
