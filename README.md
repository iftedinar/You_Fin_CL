# KnowBase

Personal knowledge extraction and learning platform.

Extract structured knowledge from YouTube videos, articles, PDFs, and notes. Study with AI-generated summaries, quizzes, and an AI Q&A assistant.

## Stack

- **Frontend:** Next.js 15, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** Supabase (Postgres + Auth)
- **AI:** OpenAI GPT-4o
- **Deployment:** Vercel

## Setup

1. Clone this repo
2. Copy `.env.local.example` to `.env.local` and fill in your keys
3. Run the SQL in `supabase-schema.sql` in your Supabase SQL editor
4. `npm install && npm run dev`

## Environment Variables

Set these in Vercel (or `.env.local` for local dev):

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `OPENAI_API_KEY` | platform.openai.com → API Keys |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL (or http://localhost:3000) |
