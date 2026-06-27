# Nextgen Sys Portfolio

## Setup
```bash
npm install
cp .env.example .env
# Edit .env — set ADMIN_TOKEN to a secure value
npm start
```

## Pages
- `/` — Portfolio homepage
- `/register` — Customer registration form (with plan selection)
- `/admin` — Registrations dashboard (requires admin token)

## API
- `POST /api/register` — Submit registration (public)
- `GET /api/stats` — Public registration count (for homepage counter)
- `GET /api/admin/registrations` — List all (requires x-admin-token header)
- `PATCH /api/admin/registrations/:ref` — Update status/notes
- `DELETE /api/admin/registrations/:ref` — Delete
- `GET /api/admin/stats` — Full stats breakdown

## Deploy to Railway
1. Push to GitHub
2. New Railway project → Deploy from GitHub
3. Set `ADMIN_TOKEN` in Railway environment variables
4. Done
