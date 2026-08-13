# Happynet HFMS

Happynet Financial Management System — a Netlify + Supabase financial operating system built around Profit First.

## Architecture
- Static application: `index.html`
- Server API: `netlify/functions/`
- Database and authentication: Supabase/PostgreSQL
- Browser-to-data path: browser → Netlify Function → Supabase
- Secrets remain server-side in Netlify environment variables.

## Happynet accounting rules
- Organization Utility inflows are classified as revenue when imported/verified as revenue.
- Tende outgoing transactions are classified as expenses.
- John/owner funding is recorded as owner financing/loan, not revenue.
- Owner repayments reduce the owner-loan liability.
- Profit First allocations are calculated from verified revenue and do not rewrite accounting actuals.

## Deploy
1. Create/configure the Supabase project.
2. Apply the SQL files in `supabase/` in the intended dependency order, or use the migration set already applied to your existing project.
3. Configure Netlify environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy the repository/folder to Netlify.
5. Sign in with a Supabase-authenticated user.
6. From **Security → System Health**, run the live integration check.

## AI / notifications
Optional integrations use server-side environment variables. The core application remains usable without an external AI, email, SMS or webhook provider.

## Production rule
A feature is considered complete only when its UI, Netlify Function, database dependencies and authorization path are implemented and connected. Documentation does not substitute for implementation.
