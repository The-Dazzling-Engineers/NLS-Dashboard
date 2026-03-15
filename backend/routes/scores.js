const express = require('express');
const fs = require('fs');

const router = express.Router();
const SCORES_PATH = '/root/.openclaw/workspace/scores.json';

router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(SCORES_PATH)) return res.json([]);
    const scores = JSON.parse(fs.readFileSync(SCORES_PATH, 'utf8'));
    res.json(scores);
  } catch (err) {
    console.error('scores error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
