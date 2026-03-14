require('dotenv').config();
const express = require('express');
const cors = require('cors');

const analyzeRoute = require('./routes/analyze');
const sheetRoute = require('./routes/sheet');
const telegramRoute = require('./routes/telegram');
const scoresRoute = require('./routes/scores');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/analyze', analyzeRoute);
app.use('/sheet', sheetRoute);
app.use('/telegram', telegramRoute);
app.use('/scores', scoresRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
