# Kwacha Sales

**Simple sales. Clear numbers.**

Kwacha Sales is a mobile-friendly sales tracker for small businesses, starting with the needs of Zambian businesses. It helps users record product sales, manage products and returns, optionally issue printable receipts, and review sales reports.

## Features

- Email/password authentication with Supabase Auth
- Business workspace setup and Zambian kwacha (ZMW) by default
- Product catalogue with default prices
- Multi-product sales with line totals and an overall transaction total
- Optional receipts showing amount received and change due
- Returns recorded separately from sales
- Daily, weekly, monthly, and yearly reporting
- Light, dark, graphite, and green themes
- Responsive layouts for mobile and desktop
- Supabase PostgreSQL with row-level security

## Technology

- React, TypeScript, and Vite
- Supabase Auth and PostgreSQL
- GitHub Pages deployment

## Local development

1. Install Node.js (LTS).
2. Clone the repository and run `npm install`.
3. Copy `.env.example` to `.env` and add your Supabase project URL and publishable key.
4. Run `npm run dev`.

Never put a Supabase service-role key or secret key in frontend environment variables. Anything prefixed with `VITE_` is bundled into the browser build.

## Database

SQL migrations live in `supabase/migrations/`. Apply migrations to the intended Supabase project in order, and verify Row Level Security policies before onboarding real customers. Rate limiting is enforced at the database layer for signed-in write operations; Supabase Auth's own request limits should also remain enabled.

## Project status

The app is under active development. Test sales, receipts, reports, account confirmation, and data access with a test business before using it for live financial records.
