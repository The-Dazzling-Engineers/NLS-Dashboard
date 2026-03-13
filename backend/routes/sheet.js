const express = require('express');
const { google } = require('googleapis');

const router = express.Router();

router.post('/', async (req, res) => {
  const { rep, score, timestamp } = req.body;

  if (!rep || score === undefined || !timestamp) {
    return res.status(400).json({ error: 'rep, score, and timestamp are required' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Sheet1!A:C',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[rep, score, timestamp]],
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('sheet error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
