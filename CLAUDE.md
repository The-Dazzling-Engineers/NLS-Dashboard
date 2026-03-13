# Project context for Claude Code

## What this is
Internal sales ops system for Next Level Systems (Ali's company). Automates call quality control, rep coaching, and EOD leaderboard for a team selling an ADHD life optimizer service.

## One-line summary
Rep finishes call → transcript scored by Claude AI → rep gets Telegram feedback → scores hit Google Sheet + dashboard → EOD leaderboard auto-sent to Ali.

## Stack
- Backend: Node.js + Express
- Frontend: Vanilla HTML/CSS/JS (single index.html)
- AI: Claude API, model claude-sonnet-4-20250514
- Integrations: Google Sheets API, Telegram Bot API
- Agent: OpenClaw on DigitalOcean VPS

## Repo structure
```
NLS-Dashboard/
├── backend/
│   ├── index.js
│   ├── routes/
│   │   ├── analyze.js    # POST /analyze
│   │   ├── sheet.js      # POST /sheet
│   │   └── telegram.js   # POST /telegram
│   ├── .env.example
│   └── package.json
└── frontend/
    └── index.html
```

## API endpoints
- POST /analyze — receives {rep, outcome, transcript}, returns scored JSON
- POST /sheet — writes {rep, score, timestamp} to Google Sheet
- POST /telegram — sends {message} to Telegram chat

## Call scoring criteria (ADHD life optimizer service)
1. Discovery & ADHD pain identification (0-10)
2. Objection handling (0-10)
3. Program clarity & value articulation (0-10)
4. Urgency & close execution (0-10)
5. Rapport & trust building (0-10)

## Score JSON shape
```json
{
  "overall": 78,
  "criteria": [
    { "name": "Discovery & ADHD pain ID", "score": 8 },
    { "name": "Objection handling", "score": 7 },
    { "name": "Program clarity", "score": 8 },
    { "name": "Urgency & close", "score": 6 },
    { "name": "Rapport & trust", "score": 9 }
  ],
  "strengths": "...",
  "improvements": "...",
  "script_suggestion": "..."
}
```

## Environment variables
```
ANTHROPIC_API_KEY=
GOOGLE_SHEETS_ID=
GOOGLE_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
PORT=3000
```

## Key rules
- Never commit .env
- Use cors so frontend can call backend
- Frontend calls backend endpoints, not Claude API directly
- Keep model pinned to claude-sonnet-4-20250514