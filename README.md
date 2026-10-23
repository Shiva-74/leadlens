# LeadLens: AI-Powered Real Estate Sales Copilot

**AI-powered lead qualification, intelligent prioritization, and sales follow-up automation for Indian real estate teams.**

LeadLens is a full-stack workspace that helps salespeople turn unstructured customer enquiries—voice notes, call recordings, chat transcripts, or form entries—into structured lead records, explainable priority scores, and actionable follow-ups.

Instead of treating lead scoring as a black box, LeadLens combines AI-assisted interpretation with deterministic scoring logic. Salespeople can review transcripts, understand why a lead received a score, prepare for a call, record the outcome, and follow through on commitments from one workspace.

> **Project status:** Core application and workflows are implemented. Automated telephony/webhook ingestion, speaker diarization, and live property-inventory matching are planned future improvements.

## Features

- **Multiple lead-capture paths:** Create a lead using a form, paste text/transcript, or record/upload audio.
- **Editable speech transcripts:** Review and correct transcription output before extracting lead details or running analysis.
- **AI-assisted lead analysis:** Extracts customer requirements, budget, location, timeline, intent, and missing information from conversational notes—including common Indian real-estate terms and Hinglish.
- **Explainable priority scoring:** Evaluates buying intent, timeline urgency, budget realism, and requirement clarity. The server calculates the final score using fixed weights rather than relying on an LLM-generated total.
- **Today's Queue:** Prioritizes active leads using follow-up timing, uncontacted hot/warm leads, and score; can flag stale leads.
- **Pre-call brief:** Generates a concise call-preparation brief with an opening line, questions, likely objections, and points to avoid.
- **Post-call debrief:** Accepts typed notes or a voice summary, updates lead analysis and score, records score history, extracts commitments, and drafts a follow-up message.
- **Lead-specific AI chat:** Answers questions using the selected lead's saved information and analysis, with instructions to avoid inventing unsupported property details.
- **One-tap WhatsApp:** Opens a `wa.me` link with a prefilled message.
- **Site-visit scheduling:** Generates a Google Calendar event link, a downloadable `.ics` invite, and a prefilled WhatsApp confirmation.
- **Session-isolated workspace:** Uses an anonymous HTTP-only session cookie rather than requiring a login for the demo.
- **Sample leads:** Load sample records to explore the workflow without entering real customer data.

## Product workflow

1. **Capture** an enquiry through a form, transcript, or audio.
2. **Review** the transcript and extracted lead information.
3. **Analyze** the lead and inspect its score, evidence, and missing details.
4. **Prioritize** the lead in Today's Queue.
5. **Prepare** with a short pre-call brief.
6. **Debrief** after the call to update the lead, record commitments, and draft a follow-up.
7. **Act** by opening WhatsApp or preparing a site-visit calendar invitation.

## Screens and routes

| Screen | Purpose |
|---|---|
| `/queue` | Prioritized list of leads needing attention |
| `/leads` | Browse and manage leads |
| `/new` | Create a lead from structured details or unstructured input |
| `/leads/:id` | Review analysis, chat with the lead assistant, and manage the call loop |

## Tech stack

**Frontend**
- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- React Router
- Lucide icons

**Backend**
- Node.js
- Express
- TypeScript (`tsx`)
- PostgreSQL (`pg`)
- Zod for request and structured-output validation
- Multer in-memory storage for audio uploads
- HTTP-only cookie-based anonymous sessions

**AI and speech**
- NVIDIA NIM for primary text analysis when configured
- Google Gemini and Groq as alternative text providers
- Groq Whisper for speech transcription, with Gemini audio as a fallback when configured

**Database**
- PostgreSQL, including Neon Serverless PostgreSQL as a hosting option

## Architecture

```text
React + Vite client
        |
        | JSON requests / multipart audio
        v
Express + TypeScript API
        |
        +--> Session handling and per-session rate limits
        |
        +--> AI provider chain
        |       +--> NVIDIA NIM
        |       +--> Google Gemini
        |       +--> Groq
        |
        +--> Speech transcription chain
        |       +--> Groq Whisper
        |       +--> Gemini audio fallback
        |
        +--> Deterministic scoring and queue prioritization
        |
        v
PostgreSQL
  sessions | leads | chat_messages | call_events
```

The Express server hosts the API and, in production, serves the built frontend from `dist/`. During development, it runs Vite middleware.

## How lead scoring works

AI evaluates four dimensions and provides supporting reasons and customer evidence. The server then computes the final score with a deterministic weighted formula:

| Dimension | Weight |
|---|---:|
| Buying intent | 35% |
| Timeline urgency | 30% |
| Budget realism | 20% |
| Requirement fit and clarity | 15% |

```ts
score = Math.round(
  intent * 0.35 +
  urgency * 0.30 +
  budget_realism * 0.20 +
  fit_clarity * 0.15
);
```

The result is clamped to `0–100` and mapped to a priority tag:

- **Hot:** 70–100
- **Warm:** 40–69
- **Cold:** 0–39

This split keeps arithmetic and thresholds consistent while using the model for contextual interpretation. The weights are heuristic product choices; they have not been trained on historical conversion outcomes.

## AI reliability and fallback behavior

- Provider calls are made by the server, not directly by the browser.
- Structured model responses are parsed and validated against Zod schemas.
- Invalid structured responses can be retried before the provider chain moves on.
- Providers without configured API keys are skipped.
- Lead-specific chat prompts use saved lead data and instruct the model to identify unknown details rather than fabricate prices, availability, carpet areas, or discounts.

The exact provider/model available at runtime depends on the configured API keys and provider availability.

## Privacy and session handling

- Audio uploads are processed in memory for transcription and are not intentionally written to application disk.
- The application retains the resulting transcript and lead data in PostgreSQL; do not upload sensitive customer recordings unless you have permission and understand the applicable provider data policies.
- Anonymous sessions are isolated using an HTTP-only cookie. This is suitable for a demo, **not a replacement for production authentication, authorization, or a multi-user access-control model**.
- In-memory rate-limit counters reset when the server restarts.

## Getting started

### Requirements

- Node.js 20 or later
- npm
- A reachable PostgreSQL database
- At least one supported text AI provider API key
- A Groq or Gemini API key for live audio transcription

### 1. Clone the repository

```bash
git clone https://github.com/Shiva-74/leadlens.git
cd leadlens
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your own values.

**PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS/Linux:**

```bash
cp .env.example .env
```

Configure the variables your chosen providers require:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NVIDIA_API_KEY` | NVIDIA NIM text analysis provider |
| `GEMINI_API_KEY` | Gemini text/audio fallback |
| `GROQ_API_KEY` | Groq text fallback and Whisper transcription |
| `PORT` | Server port; defaults to `3000` |

At least one text provider key is required for AI analysis. Configure Groq or Gemini to enable live transcription. Keep `.env` private and never commit real API keys.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The server initializes the database tables at startup, so `DATABASE_URL` must point to a reachable PostgreSQL instance.

### 5. Try the sample workflow

Use the sample-lead action in the app to load example leads, then explore the queue, lead analysis, pre-call brief, debrief, commitments, WhatsApp link, and site-visit scheduler.

### Production build

```bash
npm run build
npm start
```

`npm start` runs the Express server in production mode and serves the frontend build from `dist/`. Set `NODE_ENV=production` in the deployment environment if your hosting platform does not set it automatically, and configure the same environment variables there.

## API health check

Once the server is running, visit:

```text
http://localhost:3000/api/health
```

This endpoint reports database connectivity and whether provider keys are configured; it does not return the keys themselves.

## Current limitations

- **No telephony webhook ingestion yet:** Audio is currently supplied through the browser recorder or upload flow. Direct ingestion from a voice platform is planned.
- **No speaker diarization:** Transcription does not reliably separate customer and salesperson turns.
- **Transcription can be imperfect:** Noise, mixed-language speech, and script selection can affect accuracy. Review the transcript before analysis.
- **Heuristic scoring:** The score weights are manually chosen and have not been validated against a historical sales-conversion dataset.
- **No production authentication or CRM sync:** The demo uses anonymous sessions and does not currently integrate with an external CRM.
- **Rate limits are in memory:** Counters reset on restart and are not shared across multiple server instances.
- **Manual verification:** The project has been checked through manual workflow testing; an automated test suite is not currently included.
- **Provider limits and availability:** Requests depend on the configured AI providers, their current model access, rate limits, and service availability.

## Roadmap

Planned improvements—not currently represented as completed features:

- **Voice-platform webhook ingestion:** Receive call recordings and transcripts directly from a telephony or voice-agent platform.
- **Speaker diarization:** Label customer and salesperson turns more reliably.
- **Property inventory matching:** Match lead budgets and location preferences against a brokerage's live project and unit inventory.
- **Production readiness:** Add authenticated users, role-based access, automated tests, and deployment-grade rate limiting.
- **CRM integration:** Connect lead records and follow-up activity to external sales systems.

## AI development disclosure

AI coding assistance was used during project development for scaffolding, prompt and schema refinement, provider integration, and debugging. The application code, prompts, scoring logic, and API routes were reviewed and manually tested as part of the build.

## Contributing

Issues and pull requests are welcome. For substantial changes, please open an issue first to discuss the proposed implementation.

## License

No license has been specified yet. Unless a license is added to this repository, all rights remain with the copyright holder and reuse is not automatically granted.
