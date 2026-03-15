const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const RANGE = 'Sheet1!A:I';
const OUTCOMES = ['closed', 'no_sale', 'no_show', 'follow_up', 'not_qualified'];

// Read all rows, return { rows, sheetId }
async function getSheet(sheets) {
  const [dataRes, metaRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: RANGE }),
    sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID }),
  ]);
  return {
    rows: dataRes.data.values || [],
    sheetId: metaRes.data.sheets[0].properties.sheetId,
  };
}

// POST /sheet — upsert rep row
router.post('/', async (req, res) => {
  const { rep, score, timestamp, outcome } = req.body;

  if (!rep || score === undefined || !timestamp) {
    return res.status(400).json({ error: 'rep, score, and timestamp are required' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const { rows } = await getSheet(sheets);

    const rowIndex = rows.findIndex(r => r[0] && r[0].toLowerCase() === rep.toLowerCase());
    const outcomeKey = (outcome || 'no_sale').toLowerCase().replace(' ', '_');

    if (rowIndex === -1) {
      // New rep — append row: Rep | Calls | Avg | Closed | No Sale | No Show | Follow Up | Not Qualified | Last Updated
      const outcomeCounts = OUTCOMES.map(o => (o === outcomeKey ? 1 : 0));
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: RANGE,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[rep, 1, score, ...outcomeCounts, timestamp]] },
      });
    } else {
      // Existing rep — update counts
      const r = rows[rowIndex];
      const calls = parseInt(r[1] || 0) + 1;
      const prevAvg = parseFloat(r[2] || 0);
      const newAvg = Math.round((prevAvg * (calls - 1) + score) / calls);
      const outcomeCounts = OUTCOMES.map((o, i) => {
        const current = parseInt(r[3 + i] || 0);
        return o === outcomeKey ? current + 1 : current;
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `Sheet1!A${rowIndex + 1}:I${rowIndex + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[rep, calls, newAvg, ...outcomeCounts, timestamp]] },
      });
    }

    // Update scores cache
    const scoresPath = path.join(__dirname, '..', 'scores.json');
    let scores = [];
    if (fs.existsSync(scoresPath)) scores = JSON.parse(fs.readFileSync(scoresPath, 'utf8'));
    scores.push({ rep, score, outcome: outcomeKey, timestamp });
    fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));

    res.json({ success: true });
  } catch (err) {
    console.error('sheet error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /sheet — remove rep entirely
router.delete('/', async (req, res) => {
  const { rep } = req.body;

  if (!rep) return res.status(400).json({ error: 'rep required' });

  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const { rows, sheetId } = await getSheet(sheets);

    const rowIndex = rows.findIndex(r => r[0] && r[0].toLowerCase() === rep.toLowerCase());

    if (rowIndex !== -1) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 } } }]
        }
      });
    }

    // Update scores cache
    const scoresPath = path.join(__dirname, '..', 'scores.json');
    if (fs.existsSync(scoresPath)) {
      let scores = JSON.parse(fs.readFileSync(scoresPath, 'utf8'));
      scores = scores.filter(s => s.rep.toLowerCase() !== rep.toLowerCase());
      fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));
    }

    res.json({ success: true });
  } catch (err) {
    console.error('sheet delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
