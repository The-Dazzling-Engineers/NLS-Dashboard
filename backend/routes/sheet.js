const express = require('express');
const { google } = require('googleapis');
const path = require('path');

const router = express.Router();

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '..', 'google-credentials.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

router.post('/', async (req, res) => {
  const { rep, score, timestamp } = req.body;

  if (!rep || score === undefined || !timestamp) {
    return res.status(400).json({ error: 'rep, score, and timestamp are required' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth });

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
