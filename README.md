# Job Application Studio v2.0

> **A 100% local, privacy-first career workspace for drafting ATS-ready CVs, DIN 5008 & executive Cover Letters, evidence-audited AI prompts, multi-document PDF dossiers, and a manual Job Search CRM — built for any profession.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16+-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0+-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)

---

## Highlights

- **100% Local, Offline & Private**: Zero cloud accounts, external databases, or telemetry. Your career history, applications, CRM log, and uploads stay on your machine (`data/*.json`, `public/uploads/`, `public/documents/`). Typography ships offline via bundled `@fontsource` packages (`IBM Plex Sans`, `IBM Plex Serif`, `Plus Jakarta Sans`, `Inter`).
- **Profession-Agnostic & Multi-Language Output**: Clean English studio UI supporting tailored document output in **English**, **German (DACH)**, and **Spanish**, complete with localized headings, date formatting, DIN 5008 business letter rules, and localized PDF outline bookmarks.
- **3 ATS/Executive CV Templates + 3 Cover Letter Templates**:
  - **CVs**: *ATS Clean* (`ats-clean`), *Modern Professional* (`modern-professional`), and *DACH Tabular* (`dach-tabular`) with optional 3:4 portrait framing.
  - **Cover Letters**: *ATS Clean Letter* (`ats-letter`), *Editorial Sidebar* (`editorial-sidebar`), and *DIN 5008 Editorial* (`din-editorial`), plus a printable **STAR Interview Prep Guide**.
- **AI Prompt Studio (4 Modes & Dynamic Master CV Highlights)**: Generates strict evidence-grounded prompts for any LLM (`Claude`, `Gemini`, `ChatGPT`) across four modes — **Full Application**, **Quick Triage**, **Outreach & Portal Q&A**, and **STAR Interview Prep** — dynamically deriving selectable achievement highlights from your own Master CV.
- **Diff-Previewed JSON Import & Anti-AI Sanitizer**: Inspect section-by-section diffs before applying LLM output, undo any import in one click, strip robotic em-dashes/AI clichés, deduplicate bullets across sections, and audit every job requirement against verified quotes.
- **Manual Job Search CRM & Daily Command Center**: Track daily application/follow-up targets, filter operational views (*Pending review*, *Ready to send*, *Stale drafts > 48h*, *No response > 5d*), inspect funnel analytics, log submissions/interviews/contacts in an audit log, and link each submission to the exact exported PDF revision.
- **Master CV Manager & Multi-Page Portal PDF Export**: Maintain your complete career repository (including Deep Duty Pillars, Projects, Applied Methodologies, Work Authorization, and Interview Prep) and export comprehensive multi-page Master CV PDFs for job boards.
- **Dynamic Local PDF Attachments & Tagged Bundle Compiler**: Drop your own reference letters, diplomas, or certificates into `public/documents/` to auto-discover, toggle per application, monitor the 2 MB ATS upload cap, and compile tagged multi-document PDFs in either **DACH** (`Cover Letter → CV → Attachments`) or **ATS** (`CV → Cover Letter → Attachments`) order.
- **Atomic Storage & Verified Local Backups**: File-locked atomic writes (`proper-lockfile`), optimistic revision conflict recovery (`HTTP 409`), SHA-256 verified manual snapshots in `.local/backups`, full workspace JSON export, and orphaned-file cleanup.

> **Want a full tour of every screen and workflow?** Read [**FEATURE_GUIDE.md**](./FEATURE_GUIDE.md).

---

## Quick Start & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) **20.0.0 or higher**

### Option A: 1-Click Launcher (Windows)
1. Double-click `Install_Windows.bat` (installs dependencies, initializes sample data, and downloads Playwright Chromium).
2. Double-click `Start_App.bat` to build and launch the studio.
3. Your browser opens automatically at [http://127.0.0.1:3000](http://127.0.0.1:3000).

### Option B: 1-Click Launcher (macOS / Linux)
```bash
chmod +x install.sh start.sh
./install.sh
./start.sh
```

### Option C: Manual CLI Setup
```bash
# 1. Install dependencies
npm install

# 2. Seed local data templates, create runtime folders, and install Playwright Chromium
npm run setup

# (Optional) Install Playwright Chromium separately if skipped or updated
npm run install:chromium

# 3. Build and launch in local production mode (auto-opens http://127.0.0.1:3000)
npm run use

# Or run the Next.js development server
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser.

---

## 5-Step Workflow

```
  1. Master CV & Assets   ──▶  Enter your verified career history, photo, signature & local PDFs
            │
            ▼
  2. Prompt Studio        ──▶  Pick a mode (Triage / Full / Outreach / STAR), language & highlights
            │
            ▼
  3. External LLM         ──▶  Run the copied prompt in Claude, Gemini, or ChatGPT (no API key needed)
            │
            ▼
  4. Diff-Checked Import  ──▶  Inspect section diffs, sanitize clichés & verify ATS evidence coverage
            │
            ▼
  5. Export & CRM Log     ──▶  Export tagged vector PDFs/bundles & log submission + follow-up in CRM
```

### 1. Set Up Your Master CV & Local Assets
- Open **Master CV (`/master-cv`)** and fill in your personal details, **Work Authorization**, accepted work modes, professional links, languages, headline/summary variants, **Achievements Pool**, **Skills Pool**, **Experience History** (with optional **Deep Duty Pillars**), **Projects**, **Education**, **Certifications & Applied Methodologies**, and **Interview Prep**.
- On the **Dashboard (`/`)**, expand **Profile, Default Assets & Local Backups** to upload a default **3:4 Profile Photo** and upload or draw a transparent **Handwritten Signature**.
- *(Optional)* Drop any reference letters, diplomas, or certificates (`.pdf`) into `public/documents/`. The studio automatically discovers them with zero manual configuration.

### 2. Build an Evidence-Grounded Prompt
- Click **Prompt Studio** in the top navigation bar (or inside any application).
- Paste the job posting, optionally save it to your **Offer Preparations** queue, and select:
  - **Prompt Mode**: *Full Application*, *Quick Triage*, *Outreach & Portal Q&A*, or *STAR Interview Prep*
  - **Output Language**: *Auto-detect*, *English*, *German*, or *Spanish* (plus optional German `Sie`/`Du` addressing)
  - **Positioning Angle**, **Tone Preset**, **Target CV Length** (`330–380w`, `400–520w`, or `460–600w`), and **Priority Highlights** derived directly from your own Master CV achievements.
- Click **Copy Prompt** and run it in your preferred LLM.

### 3. Import with Section-by-Section Diff Preview
- Click **New Application → Import JSON** on the Dashboard (or **Import JSON** inside an existing draft).
- Paste the LLM JSON or upload a `.json` file. Review the validation preview and section diffs before confirming.
- The import pipeline archives the raw JSON (`data/imports/`), strips AI buzzwords and em-dashes, removes cross-section bullet duplication, and allows 1-click **Undo Import**.

### 4. Refine in the Split-Screen A4 Editor
- Use the 10 structured editor tabs (*Profile*, *Experience*, *Projects*, *Skills*, *Cover Letter*, *Strategy*, *Form Answers*, *Tracking*, *ATS Audit*, *Layout & Assets*) alongside a live paginated A4 preview.
- Run **Final Review** before exporting to catch missing contact details, placeholder remnants, language mismatches, page overflows, unverified claims, or bundles exceeding 2 MB.

### 5. Export Vector PDFs & Track in the CRM
- Use **Export PDF** to generate vector A4 PDFs via Headless Chromium: individual *CV*, *Cover Letter*, *STAR Prep*, *Attachments*, or merged bundles (*CV + Attachments*, *Cover Letter + Attachments*, *Full Application Bundle*).
- Click **Already submitted? Log submission & follow-up** to record the exact exported delivery revision, submission date, contact, and next follow-up action in your local CRM.

---

## Useful Commands

| Command | Description |
| :--- | :--- |
| `npm run setup` | Seeds `data/*.json` from templates, creates local directories, and installs Chromium |
| `npm run install:chromium` | Installs Playwright Chromium for headless vector PDF compilation |
| `npm run use` | Builds the production app and starts it on `http://127.0.0.1:3000` (auto-opens browser) |
| `npm run dev` | Starts the local development server on `http://127.0.0.1:3000` |
| `npm run backup` | Creates, verifies (`--verify`), or restores (`--restore`) SHA-256 verified workspace snapshots |
| `npm run typecheck` | Runs strict TypeScript type-checking (`tsc --noEmit`) |
| `npm run test` | Runs the unit & integration test suite (`node --test`) |
| `npm run test:security` | Runs security and PDF isolation tests |
| `npm run check:pii` | Scans tracked and untracked files to verify zero personal data leaks |

---

## Security & Privacy by Design

- **Localhost-Only Architecture**: Binds to `127.0.0.1:3000` with strict Origin/Host request guards on every API route.
- **Path Traversal & Symlink Protection**: All disk reads, writes, reference attachment lookups, and backup restores enforce canonical boundary and symlink checks.
- **Playwright SSRF & Protocol Isolation**: PDF rendering blocks external network requests and dangerous protocols (`file://`, `javascript:`), serving only bundled offline assets.
- **Hardened HTTP Headers**: Strict Content Security Policy (`default-src 'self'`, `frame-ancestors 'none'`) and MIME-sniffing protection.
- **Magic-Byte Upload Validation**: Profile photos and signatures are capped at 5 MB and verified by binary file headers (`PNG`, `JPEG`, `WEBP`).

---

## Project Structure

```
job-application-studio/
├── data/
│   ├── master-cv.example.json       # Neutral example Master CV template
│   └── applications.example.json    # Neutral example application template
├── public/
│   ├── documents/                   # Drop your local reference/certificate PDFs here
│   └── uploads/                     # Local profile photos and signatures (gitignored)
├── scripts/
│   ├── setup.mjs                    # Local environment & Playwright Chromium initializer
│   ├── use-local.mjs                # Production build & local browser launcher
│   ├── data-backup.mjs              # SHA-256 verified backup, verify & restore CLI
│   └── check-pii-leak.mjs           # Automated zero-PII privacy scanner
├── src/
│   ├── app/
│   │   ├── api/                     # Local API routes (applications, master-cv, crm,
│   │   │                            # preparations, references, export-pdf, merge-pdf,
│   │   │                            # backup, imports, intake, upload, uploads)
│   │   ├── applications/[id]/       # Split-screen A4 application editor
│   │   ├── master-cv/               # Master CV manager & multi-page PDF exporter
│   │   └── page.tsx                 # Dashboard, CRM command center & funnel analytics
│   ├── components/
│   │   ├── crm/                     # CRM Dashboard & Activity/Submission dialog
│   │   ├── editor/                  # 10 editor tabs, A4 paginator, Final Review, Cleanup
│   │   ├── master-cv/               # Master CV multi-page PDF configuration & preview
│   │   ├── templates/               # 3 CV templates, 3 Cover Letter templates, STAR Prep
│   │   ├── ImportPreviewPanel.tsx   # JSON validation & section diff viewer
│   │   ├── PromptGeneratorModal.tsx # 4-mode AI Prompt Studio
│   │   └── SignaturePad.tsx         # High-DPI HTML5 Canvas signature pad
│   └── lib/                         # Schemas, prompt builder, AI sanitizer, ATS auditor,
│                                    # PDF/merge engine, CRM engine, atomic storage
├── FEATURE_GUIDE.md                 # Detailed walkthrough of every module
├── next.config.ts                   # CSP and HTTP security headers
└── package.json                     # Dependencies and npm scripts
```

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, React 19)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Validation**: [Zod 4](https://zod.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) & [Lucide React](https://lucide.dev/)
- **Offline Fonts**: `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-serif`, `@fontsource/plus-jakarta-sans`, `@fontsource/inter`
- **PDF Engine**: [Playwright](https://playwright.dev/) (Headless Chromium) & [pdf-lib](https://pdf-lib.js.org/)
- **File Locking**: [proper-lockfile](https://github.com/moxystudio/node-proper-lockfile)

---

## License

Open-source under the [MIT License](LICENSE).
