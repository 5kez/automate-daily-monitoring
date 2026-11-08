# Automate Daily Monitoring

**Live demo:** [skez.codes/demo/monitoring](https://skez.codes/demo/monitoring/) (runs in the browser on anonymized sample data)

An automation platform that replaced a manual, Excel-based morning health check of client production servers. It was built during my Cloud Engineer internship at A-HOST Co., Ltd. (System Management Service), Nov 2025 – Mar 2026, as the sole developer.

| | Before | After |
|---|---|---|
| Morning check, all servers | 1–2 hours, by hand | ~5 minutes |
| Data entry | copied into Excel | parsed to JSON automatically |
| History | scattered spreadsheets | dated logs + PostgreSQL, trend charts |

![Dashboard home](docs/screenshots/dashboard-home.png)

## How it works

```mermaid
flowchart LR
  S[n8n Schedule Trigger] --> W[Auto SSH workflow]
  W -->|SSH over SSL VPN| L[(Linux servers)]
  W -->|SSH over SSL VPN| A[(IBM AIX servers)]
  W --> P[Code nodes: parse output to JSON]
  P --> F[(Dated raw + JSON logs)]
  P --> DB[(PostgreSQL)]
  F --> API[n8n webhook API<br/>list-files / get-file / download-file / refresh]
  API --> UI[React dashboard]
  UI --> PDF[PDF report export]
```

1. **Collect.** A scheduled n8n workflow connects to every server over SSH (through FortiClient SSL VPN) and runs `df -h`, `top`/`topas`, Oracle tablespace queries, AIX `errpt`, process checks and backup-log checks.
2. **Parse.** JavaScript Code nodes turn each command's inconsistent text output into structured JSON. Raw and JSON files are stored by `server/table/yyyy/mm`.
3. **Serve.** Webhook workflows expose a small REST API (`list-files`, `get-file`, `download-file`, `refresh`).
4. **Show.** A React + Vite dashboard reads that API: color-coded health thresholds (for example disk > 90%), trend charts, history comparison, raw/JSON download and one-click PDF reports.

## What is in this repo

The n8n backend (workflows, the custom AIX node and its Docker Compose setup) lives in its own repo: **[5kez/n8n-server-monitoring](https://github.com/5kez/n8n-server-monitoring)**.

| Path | What |
|---|---|
| `dashboard/` | React 18 + Vite dashboard (Recharts, jsPDF), ESLint + Prettier, multi-stage Dockerfile with Nginx |
| `deploy/` | Example GitHub Actions workflow that rebuilds and redeploys the dashboard container on a self-hosted Windows runner |
| `docs/` | System documentation, API reference, flow diagrams |
| `sample-data/` | Anonymized sample outputs used by the demo |

## Run it

**Dashboard demo (no n8n needed):**
```bash
cd dashboard
npm ci
python3 scripts-make-demo-data.py      # builds public/demo-data from ../sample-data
VITE_DEMO=true npm run dev              # http://localhost:3000
```

**Full stack:** start the n8n backend by following [n8n-server-monitoring](https://github.com/5kez/n8n-server-monitoring#run-it), then point the dashboard at it with `VITE_API_WEBHOOK_HOST`.

## Anonymization

This is a public copy of internal work, so:
- Client and server names are replaced with neutral names (`ERP-AIX`, `DB-01`, `DR-SITE`, ...), consistently across code, workflows and sample data.
- Internal IPs, hostnames, credential IDs, the n8n encryption key, company logos and raw command output are removed.
- Sample data for some servers is copied from a similar server with shifted numbers, so every screen has something to show.

## Stack

n8n · Docker · Docker Compose · Nginx · GitHub Actions · SSH / SSL VPN · Linux · IBM AIX · Oracle · PostgreSQL · JavaScript · TypeScript · React · Vite · Recharts · jsPDF

## Author

Tham Kaeoket · [skez.codes](https://skez.codes) · [LinkedIn](https://www.linkedin.com/in/tham-kaeoket/) · [github.com/5kez](https://github.com/5kez)
