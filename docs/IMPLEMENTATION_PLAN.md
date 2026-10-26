# Implementation plan

## Stage 1 — Frontend foundation
- React, TypeScript and Vite app scaffold.
- Mobile-first dashboard with Overview, Sales, Products, Returns and Reports.
- Prototype forms and report exports to exercise the core workflow.
- Current records are sample/in-memory data only; refresh resets the prototype.

## Stage 2 — Supabase integration
- Add email/password sign-up and sign-in.
- Create profile and business onboarding.
- Persist products, sales and returns in PostgreSQL.
- Add Row Level Security policies and verify cross-user isolation.
- Replace sample data with authenticated database queries.

## Stage 3 — Verification and polish
- Validate report totals and selected-month filtering.
- Verify price-at-sale snapshots and return separation.
- Test small-screen layouts, keyboard interaction and empty/error states.
- Add deployment instructions and environment setup.

## Important rules
- Never expose a Supabase service-role or secret key in browser code.
- Browser environment variables may contain only the Supabase URL and publishable key.
- Do not claim to know stock on hand when opening stock and stock received are unknown.
- Do not subtract returns from sales totals unless a clearly defined net-sales rule is approved.
