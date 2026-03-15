const { google } = require('googleapis');
const path = require('path');
const cron = require('node-cron');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an AI assistant for Next Level Systems (NLS), a company that helps people with ADHD build multi-million dollar businesses. You work for Ali, the owner.

Your job:
- Help manage Ali's sales team
- Answer questions about call performance, reps, and scores
- Draft messages in Ali's voice — direct, warm, no fluff
- Be concise. No filler. No "Great question!"

Business metrics to know:
- L = Leads (goal: 50/day)
- OB = Offer Breaks / calls booked (goal: 36/day)
- CL = Closes (goal: 18/day)
- Close rate goal: 50%
- Daily revenue target: $20k

Anyone scoring below 60 needs mandatory coaching review.`;

async function askClaude(userMessage) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });
  return response.content[0].text;
}

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'google-credentials.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

async function getScores() {
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: 'Sheet1!A:C',
  });
  const rows = response.data.values || [];
  return rows
    .filter(row => row[0] && row[1])
    .map(row => ({ rep: row[0], score: parseInt(row[1]), timestamp: row[2] || '' }));
}

function formatLeaderboard(scores) {
  if (!scores.length) return 'No scores logged yet.';
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const lines = sorted.map((s, i) => `${i + 1}. ${s.rep} - ${s.score}`);
  return `NLS Leaderboard\n\n${lines.join('\n')}`;
}

async function sendToChat(chatId, text) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendLeaderboard(chatId) {
  const scores = await getScores();
  const message = formatLeaderboard(scores);
  const target = chatId || process.env.TELEGRAM_CHAT_ID;
  await sendToChat(target, message);
}

function startPolling() {
  let offset = 0;

  async function poll() {
    try {
      const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates?timeout=30&offset=${offset}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.ok && data.result.length) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          const msg = update.message;
          if (!msg || !msg.text) continue;

          const text = msg.text.toLowerCase().trim();
          const keywords = ['leaderboard', 'scores', 'rankings', 'eod'];
          if (keywords.some(kw => text.includes(kw))) {
            await sendLeaderboard(msg.chat.id);
          } else {
            const reply = await askClaude(msg.text);
            await sendToChat(msg.chat.id, reply);
          }
        }
      }
    } catch (err) {
      console.error('polling error:', err.message);
    }
    setTimeout(poll, 1000);
  }

  poll();
  console.log('Telegram bot polling started');
}

function scheduleEOD() {
  cron.schedule('59 23 * * *', () => {
    console.log('Sending EOD leaderboard...');
    sendLeaderboard().catch(err => console.error('EOD report error:', err.message));
  }, { timezone: 'America/New_York' });
  console.log('EOD report scheduled for 11:59pm EST');
}

module.exports = { startPolling, scheduleEOD };
