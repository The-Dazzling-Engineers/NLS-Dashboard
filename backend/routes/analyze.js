const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are a sales call quality analyst for Next Level Systems, which sells an ADHD life optimizer service.

Evaluate the call transcript against these 5 criteria. Answer yes or no for each — only based on what actually happened in the call.

1. Was there a clear gap established between current state and desired state?
2. Did the client admit the cost of inaction?
3. Did the prospect admit the benefit of the desired state?
4. Did the prospect admit they can't do it alone?
5. Did the prospect admit now is the time to change?

Return ONLY valid JSON with no markdown or extra text, in this exact shape:
{
  "criteria": [
    { "name": "Clear gap: current vs desired state", "hit": true or false },
    { "name": "Client admitted cost of inaction", "hit": true or false },
    { "name": "Prospect admitted benefit of desired state", "hit": true or false },
    { "name": "Prospect admitted they can't do it alone", "hit": true or false },
    { "name": "Prospect admitted now is the time to change", "hit": true or false }
  ],
  "hit": <number of true criteria 0-5>,
  "total": 5,
  "strengths": "<what the rep did well>",
  "improvements": "<what the rep missed and how to fix it>",
  "script_suggestion": "<exact word-for-word line the rep could use next time>"
}`;

router.post('/', async (req, res) => {
  const { rep, transcript } = req.body;

  if (!rep || !transcript) {
    return res.status(400).json({ error: 'rep and transcript are required' });
  }

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Rep: ${rep}\n\nTranscript:\n${transcript}`,
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
