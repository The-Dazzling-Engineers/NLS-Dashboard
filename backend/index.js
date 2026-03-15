require('dotenv').config();
const express = require('express');
const cors = require('cors');

const analyzeRoute = require('./routes/analyze');
const sheetRoute = require('./routes/sheet');
const telegramRoute = require('./routes/telegram');
const scoresRoute = require('./routes/scores');
const { handleUpdate, registerWebhook, scheduleEOD } = require('./bot');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/analyze', analyzeRoute);
app.use('/sheet', sheetRoute);
app.use('/telegram', telegramRoute);
app.use('/scores', scoresRoute);

app.post('/bot', (req, res) => {
  res.sendStatus(200);
  handleUpdate(req.body);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.TUNNEL_URL) registerWebhook(process.env.TUNNEL_URL);
  scheduleEOD();
});
