const express = require('express');
const { google } = require('googleapis');
const path = require('path');

const router = express.Router();

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '..', 'google-credentials.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

router.get('/', async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Sheet1!A:C',
    });

    const rows = response.data.values || [];

    const scores = rows
      .filter(row => row[0] && row[1])
      .map(row => ({
        rep: row[0],
        score: parseInt(row[1]),
        timestamp: row[2] || '',
      }));

    res.json(scores);
  } catch (err) {
    console.error('scores error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
