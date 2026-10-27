# CRM (starter kit copy)

This app started as the Handy Andy TV mounting CRM. It is being reused for a cleaning company.
Read ../README.md and ../ADAPT-TO-CLEANING.md before changing anything.

- Database: Supabase, everything in schema `app` (not `public`). Migrations in supabase/migrations, run in number order, then 0900.
- Hosting: Vercel. Server code in api/ (one function per file), screens in public/.
- Office dashboard: public/admin.html + api/admin.js. Tech phone app: public/tech.html + api/tech.js. Online booking: public/widget.js + api/book.js.
- Tech pay is computed on the fly (api/_lib/payroll.js + computeBizPayroll in api/admin.js). Never stored.
- Never put secrets in code. Never text or email real customers while testing.
- After editing a big file, check syntax: `node --check api/admin.js`, and test that the app still loads before deploying.
