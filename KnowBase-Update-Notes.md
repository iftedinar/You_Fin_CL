# KnowBase Update — July 9, 2026

The updated project is in the `You_Fin_CL` subfolder of this folder (a full git working copy of your repo, with all changes uncommitted so you can review the diff).

## What's done

**1. Much deeper, more reliable extraction (your #1 request)**
- YouTube transcripts now come via `youtubei.js` (the maintained Innertube client) with two fallbacks: the old `youtube-transcript` package, then Supadata (if you add its key). The old package alone was frequently broken.
- Timestamps are now kept — the transcript is stored with `[MM:SS]` markers, so the AI can tell you *where* in the video each idea appears.
- Long content is no longer truncated at 140k chars and summarized in one shot. It's split into chunks; a fast model (gpt-4o-mini) takes detailed notes on every chunk in parallel, then gpt-4o merges them. A 2-hour lecture now gets fully read.
- New extraction outputs per resource: **chapter-by-chapter breakdown** (with clickable timestamps that jump the embedded video to that moment), **key data points** (every number/stat cited), **mentioned resources** (books, tools, tickers, people), **flashcards**, and **go deeper** (AI-suggested next topics with search links).
- Article extraction now preserves headings/lists/tables instead of flattening to a blob, and falls back to Jina Reader for JavaScript-heavy pages.

**2. Platform improvements**
- **Review page** (sidebar → Review): spaced-repetition flashcards (SM-2 scheduling: Again/Hard/Good/Easy). Cards are auto-generated when you add a resource.
- **Export to Markdown**: download button on every resource — Obsidian/Notion-ready notes.
- **Library**: search now covers concepts, strategies, and summaries; added a difficulty filter.
- **Related in your library**: each resource shows others sharing its topic tags.
- AI models are now configurable via env (`OPENAI_MODEL`, `OPENAI_FAST_MODEL`) — no code change needed to upgrade.

**3. Guest accounts (your #3 request)**
- "Continue as guest" button on the login page (Supabase anonymous sign-in).
- Guests see a banner + sidebar prompt; the `/auth/upgrade` page converts a guest to a full account **keeping all their data** (same user id).
- Signing out as guest warns that guest data will be orphaned.

## What YOU need to do (in order)

1. **Supabase — enable guest sign-in**: Dashboard → Authentication → Sign In / Up → enable **Anonymous sign-ins**. Without this the guest button shows "not enabled."
2. **Supabase — run the new migration**: SQL Editor → run `supabase-migration-flashcards.sql`. Without it, extraction still works but flashcards won't be saved.
3. **Review & push**: open `You_Fin_CL`, run `git diff` to review, then:
   ```
   git add -A
   git commit -m "Deep extraction (chapters/timestamps/flashcards), guest accounts, review page, MD export"
   git push
   ```
4. **Vercel**: after push it auto-deploys. Recommended: enable **Fluid Compute** on the project (Settings → Functions) so long videos get up to 300s of processing time (the extract route now sets `maxDuration = 300`).
5. Optional env vars in Vercel (see below).

## What's left / not included

- **Videos without captions**: still unsupported — would need audio download + Whisper transcription, which doesn't fit Vercel serverless well (needs yt-dlp). Possible later via a small worker (e.g., Railway/Modal) if you want it.
- Old resources you already saved won't have chapters/flashcards — re-add them to get the new extraction.
- Extraction runs while the "Add resource" request is open; if a very long video exceeds the Vercel limit, the resource shows an error and you can retry.

## API keys you can (optionally) add

| Key | Where | What it buys you |
|---|---|---|
| `SUPADATA_API_KEY` | supadata.ai (free tier) | Third fallback for YouTube transcripts — near-100% fetch reliability |
| `JINA_API_KEY` | jina.ai (free tier) | Higher rate limits for the article-extraction fallback (works without a key too) |
| `OPENAI_MODEL` / `OPENAI_FAST_MODEL` | — | Point at newer/cheaper OpenAI models anytime |
| YouTube Data API key | Google Cloud (free) | *Not needed now* — only if you later want playlist import or channel monitoring |
| AssemblyAI / Deepgram | their sites | Only needed if we later add no-caption video transcription |

All keys go in Vercel → Settings → Environment Variables (never in the repo). New keys are listed in `.env.local.example`.
