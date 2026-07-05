# MedQuery AI

MedQuery AI is a healthcare-focused application that translates natural language clinical questions into structured SQL queries.

## Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn-style reusable UI components
- Zustand (localStorage-backed history)
- Prism.js SQL syntax highlighting

## MVP Features

- Natural language query input
- Medical concept recognition with ICD-10 and SNOMED mappings
- Filter extraction for demographics and date constraints
- SQL generation engine
- Explainability panel with generation steps
- Confidence score for extracted concepts
- Voice input via browser speech recognition
- Copy and download generated SQL
- Query history persisted in browser localStorage
- Dark and light theme toggle

## Quick Start

1. Install dependencies

	npm install

2. Run development server

	npm run dev

3. Open in browser

	http://localhost:3000

## Build and Validation

- Lint: npm run lint
- Production build: npm run build

## Gemini Integration

Gemini is integrated via a secure server route at `POST /api/translate`.

To enable Gemini Assist mode, create a `.env.local` file in the project root with:

GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

Notes:

- The API key is read only on the server and is never exposed to the browser.
- If Gemini is unavailable, the app automatically falls back to deterministic SQL generation.

## Project Structure

- src/app: App router layout, page, and global styles
- src/components: Dashboard and reusable UI components
- src/services: NLP parser, dictionary matcher, SQL generator, translator orchestrator
- src/hooks: Speech input hook
- src/store: Zustand query state and history persistence
- src/types: Shared TypeScript models
- src/data: Medical dictionary seed data and sample prompts

## Notes

- The dictionary is intentionally curated for a hackathon MVP and can be expanded with larger ICD-10, SNOMED CT, or UMLS datasets.
- SQL output is generated as deterministic explainable logic suitable for demos and rapid prototyping.
