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
      const sorted = [...scores].sort((a, b) => b.score - a.score);
      const lines = sorted.map((s, i) => `${i + 1}. ${s.rep} - ${s.score} (${s.timestamp})`).join('\n');
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

const fs = require('fs');
const path = require('path');
const SCORES_PATH = path.join(__dirname, 'scores.json');

function getScores() {
  if (!fs.existsSync(SCORES_PATH)) return [];
  return JSON.parse(fs.readFileSync(SCORES_PATH, 'utf8'));
}

function formatLeaderboard(scores) {
  if (!scores.length) return 'No scores logged yet.';

  // Group by rep
  const groups = {};
  scores.forEach(s => {
    const key = s.rep.toLowerCase();
    if (!groups[key]) groups[key] = { rep: s.rep, scores: [], outcomes: {} };
    groups[key].scores.push(s.score);
    const o = s.outcome || 'no_sale';
    groups[key].outcomes[o] = (groups[key].outcomes[o] || 0) + 1;
  });

  const reps = Object.values(groups).map(g => ({
    rep: g.rep,
    avg: Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length),
    calls: g.scores.length,
    outcomes: g.outcomes,
  })).sort((a, b) => b.avg - a.avg);

  const medals = ['🥇', '🥈', '🥉'];
  const lines = reps.map((r, i) => {
    const rank = medals[i] || `${i + 1}.`;
    const outcomeStr = Object.entries(r.outcomes)
      .map(([k, v]) => `${v} ${k.replace('_', ' ')}`)
      .join(', ');
    return `${rank} ${r.rep} — ${r.avg}/100 (${r.calls} call${r.calls > 1 ? 's' : ''}: ${outcomeStr})`;
  });

  const total = scores.length;
  const closes = scores.filter(s => s.outcome === 'closed').length;
  const avgAll = Math.round(scores.reduce((a, s) => a + s.score, 0) / total);

  return `🏆 NLS Leaderboard\n\n${lines.join('\n')}\n\n📊 ${total} calls · ${closes} closes · ${avgAll} avg score`;
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
