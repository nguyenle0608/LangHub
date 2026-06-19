# LangHub — Localization Management Tool

## Project Overview
Web-based localization tool for managing multi-language translations.
Similar to Lokalise / Gridly. Target: Mobile App & Web App developers.
AI Translation is a FUTURE feature — do NOT implement AI calls in MVP.

## Tech Stack
- Framework: Next.js 14 (App Router, TypeScript strict)
- Database: Supabase (PostgreSQL + Realtime + Auth)
- Styling: Tailwind CSS + shadcn/ui (dark theme, zinc base)
- Deploy: Vercel
- Package manager: pnpm

## Key Commands
- pnpm dev           → start dev server (localhost:3000)
- pnpm build         → production build
- pnpm lint          → eslint check
- pnpm typecheck     → tsc --noEmit
- pnpm test          → vitest
- pnpm db:push       → supabase db push (apply migrations)
- pnpm db:types      → generate TypeScript types from Supabase

## Coding Conventions
- TypeScript strict mode, no `any`
- Functional components only, no class components
- Named exports (no default exports except page.tsx/layout.tsx)
- Tailwind for all styling, no inline styles
- Server Components by default, "use client" only when needed
- Zod for all form validation and API input validation
- Error boundaries on all major page sections

## Critical Rules
- NEVER commit .env files
- All DB queries go through lib/supabase/queries/ — NOT direct calls in components
- All API routes must validate auth before any DB operation
- Parser/Exporter logic in lib/parsers/ and lib/exporters/ (pure functions, no side effects)
- Translation keys stored as dot.notation in DB, rebuilt to nested on export
- AI_PLACEHOLDER: Any AI translate button shows "Coming Soon" toast — do not wire up
- Version system: EVERY destructive operation (import, bulk delete, restore)
  must auto-create a snapshot BEFORE proceeding
