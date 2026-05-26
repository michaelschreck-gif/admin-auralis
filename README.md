# Auralis Admin Panel

Administrationsoberfläche für [Auralis](https://github.com/michaelschreck-gif/auralis) – das KI-Visibility-Monitoring-Tool.

Live: [admin-auralis.vercel.app](https://admin-auralis.vercel.app)

---

## Was ist drin?

- **Nutzerverwaltung** mit Liste, Suche, Filter (Status + Tarif), Plan-Edit, Profil-Edit, Einladen per Magic-Link, Sperren/Entsperren, Hard-Delete
- **User-Detail-Seite** pro Profil mit Topics (Monitoring-Schedules), letzten 25 Reports, Topic-Editing und **manueller Analyse-Trigger** über die Anthropic-API
- **Stats-Dashboard** mit KPIs, Tarif-Verteilung, 7-Tage-Reports-Chart und Cron-Health
- **Audit-Log** – unveränderbares Protokoll aller Admin-Aktionen mit Filter und Payload-Viewer
- Self-Protection: Admin kann sich nicht selbst sperren, löschen oder Admin-Rechte entziehen; mindestens ein Admin muss im System bleiben

## Tech-Stack

- **Next.js 16.2.6** (App Router, Turbopack) – `proxy.ts` statt klassischer `middleware.ts`
- **React 19.2.4** + **Tailwind v4**
- **Supabase** (`@supabase/ssr` für SSR-Auth, `@supabase/supabase-js` mit Service-Role für Admin-Operationen)
- **Anthropic SDK** für manuelle Analyse-Trigger (Modell `claude-sonnet-4-5`)
- Geteiltes Datenbank-Schema mit dem Haupt-Tool, eigene Migration für `audit_log` (siehe `auralis/supabase/migrations/`)

## Auth-Modell

Drei Schichten:

1. **`proxy.ts`** prüft die Supabase-Session und redirected nicht-eingeloggte User von `/dashboard/*` auf `/login`.
2. **`app/dashboard/layout.tsx`** liest das `profiles`-Row für den User und prüft `is_admin = true`. Wenn nicht → redirect `/login`.
3. **Server Actions + API Routes** rufen alle `requireAdmin()` als Defense-in-Depth, bevor sie irgendwas in die DB schreiben.

Service-Role-Operationen laufen ausschließlich serverseitig in `lib/supabase/admin.ts` (lazy-init).

## Required Env-Vars

| Variable | Wozu | Pflicht? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-Projekt-URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon (Public) Key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-Role-Key (umgeht RLS) | ✅ |
| `ANTHROPIC_API_KEY` | Für `/api/admin/run-analysis/[scheduleId]` | ✅ (für manuelle Analyse) |
| `NEXT_PUBLIC_MAIN_APP_URL` | Redirect-Ziel für Invite-Magic-Links | empfohlen |

Alle drei Supabase-Vars **müssen für Production UND Preview** in Vercel gesetzt sein, sonst crashen Preview-Deployments mit „supabaseUrl is required".

## Setup lokal

```bash
git clone https://github.com/michaelschreck-gif/admin-auralis.git
cd admin-auralis
npm install

# .env.local mit den oben genannten Vars anlegen
# Werte aus Supabase Dashboard → Settings → API Keys (Legacy-Tab für anon/service_role)

npm run dev
# → http://localhost:3000
```

## Deployment

- Vercel-Projekt: `auralis-projects1/admin-auralis`
- Auto-deploy bei push auf `main`
- Custom-Domain: aktuell `admin-auralis.vercel.app`

## Routen

| Pfad | Beschreibung |
|---|---|
| `/login` | E-Mail + Passwort Login mit `is_admin`-Check |
| `/auth/callback` | OAuth/Magic-Link Callback |
| `/dashboard` | User-Verwaltung |
| `/dashboard/users/[id]` | User-Detail mit Topics + Reports |
| `/dashboard/stats` | Statistiken & Cron-Health |
| `/dashboard/audit` | Audit-Log mit Filter |
| `/api/admin/run-analysis/[scheduleId]` | POST – manueller Analyse-Trigger (60s maxDuration) |
| `/api/admin/report/[id]/query-results` | GET – Query-Results für Report-Drawer |

## Audit-Log

Geschrieben durch `logAudit()` in `lib/supabase/admin.ts`, gelesen über RLS-Policy `audit_log: admin read`. Schreiben geht nur über Service-Role (kein INSERT/UPDATE/DELETE für authenticated User → unveränderbarer Trail).

Erfasste Aktionen:

- `user.invite`, `user.plan.update`, `user.profile.update`
- `user.ban`, `user.unban`, `user.delete`
- `schedule.frequency.update`, `schedule.toggle`
- `schedule.analyze.manual`

## Wartung

- DB-Typen regenerieren nach Schema-Änderungen: Supabase-CLI `supabase gen types typescript` oder via Supabase MCP-Tool
- `lib/auralis/queries.ts` und `analyzer.ts` sind **Kopien** aus dem Haupt-Repo – bei Änderungen dort hier auch nachziehen (siehe Drift-Note in `lib/auralis/runner.ts`)

## Roadmap

Siehe `admin-auralis-ROADMAP.md` im übergeordneten Workspace.

---

Built with Claude in 5 Sprints (Mai 2026).
