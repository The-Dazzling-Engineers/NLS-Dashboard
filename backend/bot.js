const cron = require('node-cron');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an AI assistant for Next Level Systems (NLS), a company that helps people with ADHD build multi-million dollar businesses. You work for Ali, the owner.

Your job:
- Help manage Ali's sales team
- Answer questions about call performance, reps, and scores
- Draft messages in Ali's voice — direct, warm, no fluff
- Be concise. No filler. No "Great question!"


Anyone scoring below 60 needs mandatory coaching review.`;

async function askClaude(userMessage) {
  let systemWithData = SYSTEM_PROMPT;
  try {
    const scores = await getScores();
    if (scores.length) {
      const sorted = [...scores].sort((a, b) => (b.totalHits / b.totalPossible) - (a.totalHits / a.totalPossible));
      const lines = sorted.map((s, i) => `${i + 1}. ${s.rep} - ${s.totalHits}/${s.totalPossible} criteria hit (${s.calls} calls)`).join('\n');
      systemWithData += `\n\nCurrent leaderboard data:\n${lines}`;
    }
  } catch (err) {
    // proceed without scores if fetch fails
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: systemWithData,
    messages: [{ role: 'user', content: userMessage }],
  });
  return response.content[0].text;
}

const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getScores() {
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: 'Sheet1!A:F',
  });
  const rows = res.data.values || [];
  // Skip header row, return rep data
  return rows.slice(1).filter(r => r[0]).map(r => ({
    rep: r[0],
    calls: parseInt(r[1] || 0),
    totalHits: parseInt(r[3] || 0),
    totalPossible: parseInt(r[4] || 0),
  }));
}

function formatLeaderboard(scores) {
  if (!scores.length) return 'No scores logged yet.';

  const sorted = [...scores].sort((a, b) => (b.totalHits / b.totalPossible) - (a.totalHits / a.totalPossible));

  const medals = ['🥇', '🥈', '🥉'];
  const lines = sorted.map((r, i) => {
    const rank = medals[i] || `${i + 1}.`;
    return `${rank} ${r.rep} — ${r.totalHits}/${r.totalPossible} (${r.calls} call${r.calls > 1 ? 's' : ''})`;
  });

  const totalCalls = scores.reduce((a, s) => a + s.calls, 0);
  const totalHits = scores.reduce((a, s) => a + s.totalHits, 0);
  const totalPossible = scores.reduce((a, s) => a + s.totalPossible, 0);

  return `🏆 NLS Leaderboard\n\n${lines.join('\n')}\n\n📊 ${totalCalls} calls · ${totalHits}/${totalPossible} criteria hit`;
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

async function handleUpdate(update) {
  const msg = update.message;
  if (!msg || !msg.text) return;

  const text = msg.text.toLowerCase().trim();
  const keywords = ['leaderboard', 'scores', 'rankings', 'eod'];
  try {
    if (keywords.some(kw => text.includes(kw))) {
      await sendLeaderboard(msg.chat.id);
    } else {
      const reply = await askClaude(msg.text);
      await sendToChat(msg.chat.id, reply);
    }
  } catch (err) {
    console.error('handleUpdate error:', err.message);
  }
}

async function registerWebhook(tunnelUrl) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: `${tunnelUrl}/bot` }),
  });
  const data = await res.json();
  console.log('Webhook registered:', data.description);
}

function scheduleEOD() {
  cron.schedule('59 23 * * *', () => {
    console.log('Sending EOD leaderboard...');
    sendLeaderboard().catch(err => console.error('EOD report error:', err.message));
  }, { timezone: 'America/New_York' });
  console.log('EOD report scheduled for 11:59pm EST');
}

module.exports = { handleUpdate, registerWebhook, scheduleEOD };
