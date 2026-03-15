const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
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

    // Write scores cache
    const scoresPath = path.join(__dirname, '..', 'scores.json');
    let scores = [];
    if (fs.existsSync(scoresPath)) {
      scores = JSON.parse(fs.readFileSync(scoresPath, 'utf8'));
    }
    scores.push({ rep, score, timestamp });
    fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));

    res.json({ success: true });
  } catch (err) {
    console.error('sheet error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/', async (req, res) => {
  const { rep, timestamp } = req.body;

  if (!rep || !timestamp) {
    return res.status(400).json({ error: 'rep and timestamp required' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Sheet1!A:C',
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === rep && row[2] === timestamp);

    if (rowIndex === -1) return res.status(404).json({ error: 'Row not found' });

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID });
    const sheetId = spreadsheet.data.sheets[0].properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      requestBody: {
        requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 } } }]
      }
    });

    // Update scores cache
    const scoresPath = path.join(__dirname, '..', 'scores.json');
    if (fs.existsSync(scoresPath)) {
      let scores = JSON.parse(fs.readFileSync(scoresPath, 'utf8'));
      scores = scores.filter(s => !(s.rep === rep && s.timestamp === timestamp));
      fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));
    }

    res.json({ success: true });
  } catch (err) {
    console.error('sheet delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
