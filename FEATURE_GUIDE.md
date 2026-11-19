# Job Application Studio v2.0 — Complete Feature Guide

Welcome to **Job Application Studio v2.0**, a 100% local, privacy-first career operations and document compilation workspace built with **Next.js 16**, **React 19**, **TypeScript 5**, **Tailwind CSS 4**, **Playwright Chromium**, and **pdf-lib**.

This guide walks through every module in the studio, explaining how each feature works and how it helps you produce accurate, ATS-parseable, recruiter-ready applications across any industry or country.

---

## Table of Contents

1. [Dashboard, Funnel Analytics & Manual Job Search CRM](#1-dashboard-funnel-analytics--manual-job-search-crm)
2. [Master CV Manager & Multi-Page Portal PDF Export](#2-master-cv-manager--multi-page-portal-pdf-export)
3. [Global Assets: 3:4 Executive Portrait & Handwritten Signature Pad](#3-global-assets-34-executive-portrait--handwritten-signature-pad)
4. [AI Prompt Studio (4 Modes & Dynamic Master CV Highlights)](#4-ai-prompt-studio-4-modes--dynamic-master-cv-highlights)
5. [Diff-Checked JSON Import & Anti-AI Sanitization](#5-diff-checked-json-import--anti-ai-sanitization)
6. [Split-Screen Live Document Editor (`/applications/[id]`)](#6-split-screen-live-document-editor-applicationsid)
7. [Readiness Toolbar, Text Cleanup & Pre-Send Final Review](#7-readiness-toolbar-text-cleanup--pre-send-final-review)
8. [Document Templates & Offline `@fontsource` Typography](#8-document-templates--offline-fontsource-typography)
9. [Strategy, Objection Neutralizers, Outreach & Portal Form Answers](#9-strategy-objection-neutralizers-outreach--portal-form-answers)
10. [ATS Evidence Audit & Keyword Coverage](#10-ats-evidence-audit--keyword-coverage)
11. [Dynamic Local PDF Attachments & Tagged Bundle Compiler](#11-dynamic-local-pdf-attachments--tagged-bundle-compiler)
12. [Atomic Storage, Conflict Recovery & Verified Local Backups](#12-atomic-storage-conflict-recovery--verified-local-backups)

---

## 1. Dashboard, Funnel Analytics & Manual Job Search CRM

The **Dashboard (`/`)** unifies your daily job-search command center with your full application pipeline.

### Manual Job Search CRM (`CrmDashboard` & `CrmActionDialog`)
- **Daily Targets & Pace**: Set manual daily goals for applications submitted and follow-ups completed, without automated scraping or background jobs.
- **Actionable Audit Log**: Record every submission, follow-up, recruiter reply, interview stage, and outcome as explicit dated events (with void/correction support so history stays auditable).
- **Frozen Delivery Linkage**: When logging a submission, attach the exact exported PDF delivery record (revision number, filename, and timestamp) so you always know which CV/letter version a company received.
- **Contact Directory**: Store recruiter and hiring-manager contacts locally and reuse them across follow-up actions.

### Pipeline Filters, Operational Views & Funnel Strip
- **Status Pills**: Filter across **All**, **Drafts**, **Reviewed**, **Applied**, **Interviewing**, **Offered**, **Rejected**, and **Archived**.
- **Operational Views**: Surface stalled or unconfirmed items in one click:
  - *Pending review*
  - *Reviewed, not sent*
  - *Sent without next action*
  - *Sent without confirmed date*
  - *Ready to send (Fit ≥ 7.5)*
  - *Stale drafts > 48h*
  - *Sent without contact*
  - *No response > 5 days*
- **Funnel Analytics Strip**: Live counters for **Applied (7d)**, **Confirmed submissions**, **Applications with contact**, **Interviews/Offers**, **Language breakdown** (`EN` / `DE` / `ES`), and **Duplicate company/role alerts**.
- **Persistent Multi-Filtering & Sorting**: Search by company, role, location, or notes; filter by document language, role tier, or AI recommendation; sort by last edited, fit score, or company name — all persisted locally (`jas_dashboard_filters_v1`).

### Dual-Mode Application Creation (`+ New Application`)
- **Manual Entry**: Spin up a clean draft seeded from your Master CV by choosing Company Name, Role Title, and Document Language (`English`, `German`, or `Spanish`).
- **Import JSON**: Paste or upload `.json` output from your external LLM. Full applications create new drafts; **Quick Triage** JSONs can be saved directly into your **Offer Preparations** queue without creating an empty CV; **Outreach** and **STAR Interview Prep** JSONs can merge cleanly into an existing application.

---

## 2. Master CV Manager & Multi-Page Portal PDF Export

Your **Master CV (`/master-cv`, stored in `data/master-cv.json`)** is your single verified source of truth. Every new application and every AI prompt draws strictly from this repository.

### Ten Structured Tabs
1. **Profile & Contact**: Full Name, Location, Email, Phone, Availability, explicit **Work Authorization** (never inferred from location), accepted **Work Modes**, **Professional Links**, and **Languages**.
2. **Headlines & Summaries**: Role-family headline and professional summary variants with live word counters (`≤ 65 words` target).
3. **Achievements Pool**: Verified, metric-backed career milestones (`achievementsPool`) with word-count indicators (`≤ 28 words` target) and reordering controls. These achievements also power the dynamic priority highlight pills in Prompt Studio.
4. **Skills Pool**: Categorized skill groups (`skillsPool`) with inline tag editing and reordering.
5. **Experience**: Chronological employment history (`experienceHistory`) with per-role default inclusion toggles, role summaries, quantifiable bullets, and expandable **Deep Duty Pillars** (detailed responsibility catalogs used by Prompt Studio to ground tailored bullets without cluttering baseline drafts).
6. **Projects**: Independent or cross-functional projects (`projectsHistory`) with role, dates, short description, tech stack, repository/demo URLs, and bullet points.
7. **Education**: Degrees, diplomas, and formal training (`educationHistory`).
8. **Certifications**: Official credentials (name, issuing authority, date, credential ID, validity) plus a separate **Applied Methodologies & Competencies** list (`specializedCompetencies`) to represent unaccredited frameworks honestly.
9. **Interview Prep**: Reusable career narrative summary, structured **STAR Stories**, interviewer questions, and quick call reference notes.
10. **Master CV PDF**: Dedicated multi-page **Master CV PDF Panel** (`MasterCvPdfPanel`) to configure language, template, typography, accent color, photo toggle, and section inclusion — ideal for exporting a comprehensive multi-page CV for job boards and recruiter databases.

---

## 3. Global Assets: 3:4 Executive Portrait & Handwritten Signature Pad

Expand **Profile, Default Assets & Local Backups** on the Dashboard (or open **Layout & Assets** inside any application):

### Profile Photo (Optional 3:4 Portrait)
- Supports `PNG`, `JPG`, and `WEBP` up to 5 MB (verified via magic-byte headers on upload).
- Renders cleanly in three frame styles: **Executive Portrait (3:4)**, **Modern Squircle (1:1)**, and **Studio Circle (1:1)**, with adjustable width and placement (*Right*, *Left*, or *Centered*).
- Can be toggled `ON` or `OFF` globally or per application depending on regional conventions (e.g., enabled for DACH/European markets, disabled for US/UK no-photo norms).

### Handwritten Signature & In-App Drawing Pad
- Upload a transparent signature image or click **Draw Signature In-App** to open the high-DPI HTML5 **Signature Pad** (`SignaturePad.tsx`).
- Smooth vector-like stroke interpolation exports a crisp transparent PNG for your cover letter closing block, with customizable width and alignment (*Left*, *Center*, *Right*).

---

## 4. AI Prompt Studio (4 Modes & Dynamic Master CV Highlights)

Open **Prompt Studio** from the Dashboard or any application editor (`PromptGeneratorModal.tsx` + `src/lib/promptBuilder.ts`). No LLM API keys are stored or required — the studio builds an evidence-grounded prompt you copy into **Claude**, **Gemini**, or **ChatGPT**.

### Four Tailored Prompt Modes
1. **Full Application (`full_application`)**: Generates a complete tailored CV, localized Cover Letter, requirement-by-requirement ATS evidence analysis, fit assessment, salary positioning, recruiter objection neutralizers, portal form answers, and optional STAR interview prep.
2. **Quick Triage (`triage_only`)**: Fast fit/gap assessment to decide whether a posting is worth a full tailored application; results can be saved directly to **Offer Preparations** without creating a draft.
3. **Outreach & Portal Q&A (`outreach_only`)**: Generates concise recruiter/hiring-manager outreach notes, follow-up templates, and tailored answers to specific screening questions.
4. **STAR Interview Prep (`interview_prep`)**: Builds role-specific pitches, grounded STAR story cards, objection scripts, and smart interviewer questions.

### Customization Controls
- **Output Language**: `Auto-detect`, `English`, `German`, or `Spanish` — plus optional German addressing mode (`Auto`, formal `Sie`, or informal `Du`).
- **Positioning Angle**: `Auto`, `Technical Execution`, `Strategy & Leadership`, `Operations & Delivery`, `Client & Stakeholder`, or `Governance & Compliance`.
- **Tone Preset**: `Auto`, `Startup / Modern`, `Enterprise / Formal`, or `Technical / Direct`.
- **Target CV Density**:
  - *Ultra-Compact* (`330–380 words · 1 page`)
  - *Clean Executive* (`400–520 words · 1–2 pages`, default)
  - *Comprehensive* (`460–600 words · 2 pages`)
- **Dynamic Priority Highlights**: Automatically generated from your Master CV's `achievementsPool` (zero hardcoded personal examples). Toggle the exact milestones you want the LLM to prioritize.
- **Offer Preparations Queue & Duplicate Detection**: Save multiple job postings with posting URL, job ID, deadline, and salary hint; the studio warns (without blocking) if a posting URL, job ID, or job description matches an existing application.
- **Strict Grounding Guardrails**: Every prompt wraps your Master CV and job posting in escaped data blocks and forbids fabricated employers, metrics, credentials, or work authorization claims.

---

## 5. Diff-Checked JSON Import & Anti-AI Sanitization

When importing LLM JSON via **New Application → Import JSON** or the editor's **Import JSON** modal (`src/lib/importPreview.ts` + `src/lib/aiJsonMapper.ts`):

- **Section-by-Section Diff Preview**: Before modifying your draft, `ImportPreviewPanel` shows validation results, detected mode, fit summary, and exact field-level changes.
- **Raw Import Archival & 1-Click Undo**: Every accepted import is archived untouched in `data/imports/<runId>.json`, and an **Undo Import** button remains available in the editor header until you make manual edits.
- **Anti-AI Cliché & Punctuation Sanitizer**: Flags and cleans robotic em-dash separators and overused AI clichés across English, German, and Spanish.
- **Cross-Section Deduplication**: Measures token overlap between `Key Achievements` and `Experience` bullets so recruiters never read near-identical claims twice.
- **DIN 5008 Subject Deduplication**: Ensures the cover letter opening never repeats the subject line.

---

## 6. Split-Screen Live Document Editor (`/applications/[id]`)

The application editor pairs 10 structured form tabs on the left with a live paginated A4 preview on the right (with a clean **Editor / A4 Preview** toggle on narrower viewports):

1. **Profile**: Company, role title, document language, contact header, availability, headline, and professional summary.
2. **Experience**: Edit, add, reorder, or toggle visibility of work experience entries and bullets; pull verified items from your Master CV catalog.
3. **Projects**: Edit project entries, tech stack, links, and bullets, or toggle project visibility on/off.
4. **Skills**: Manage Key Achievements, grouped Core Skills, Education, Certifications, and Applied Methodologies.
5. **Cover Letter**: Edit date line, subject line (`Betreffzeile`), positioning line, sidebar labels, greeting, structured paragraphs, closing phrase, and copy plain text in one click.
6. **Strategy**: View and refine AI fit score, probability tier, apply/skip recommendation, role classification, keyword strategy, salary positioning, recruiter objection neutralizers, and quality control notes.
7. **Form Answers**: Ready-to-copy responses for common ATS portal fields (*Short Motivation*, *Why This Role*, *Why This Company*, *Additional Message*, *Availability*, *Work Authorization*, *Salary Expectation*, *Links*) plus custom portal Q&A and outreach messages.
8. **Tracking**: Pipeline status, job description storage, posting URL/ID/deadline, interview schedule, recruiter contact, notes, CRM review confirmation, and 1-click CRM activity logging.
9. **ATS Audit**: Requirement-by-requirement evidence verification and live keyword placement analysis against the saved job description.
10. **Layout & Assets**: Template switcher, executive accent palette, offline font presets, typography sliders, 1-click Smart Auto-Fit, portrait/signature controls, bundle order (*DACH* vs *ATS*), and dynamic local PDF attachment checkboxes.

### Auto-Save & Keyboard Shortcuts
- **Ctrl+S / Cmd+S** saves immediately from anywhere in the editor or Master CV.
- Optional **3-second debounced Auto-Save** (persisted in `jas_autosave_enabled`), which automatically pauses on save conflicts so a newer revision is never overwritten.

---

## 7. Readiness Toolbar, Text Cleanup & Pre-Send Final Review

- **Live A4 Pagination & Readiness Bar (`ApplicationPreviewPane`)**: Measures true A4 page breaks (`210mm × 297mm`) in real time, tracks CV word budget and bullet length, offers quick section toggles, and provides 1-click **Smart Auto-Fit** typography tuning.
- **Text Cleanup Dialog (`TextCleanupDialog`)**: Highlights detected AI clichés, awkward punctuation, or repetitive wording and lets you approve cleanups interactively.
- **Pre-Send Final Review (`FinalReviewDialog` + `src/lib/finalReview.ts`)**: Runs a comprehensive pre-flight checklist before submission, flagging:
  - Unsaved edits or failed saves
  - Missing contact info, unconfirmed availability, or unconfirmed work authorization
  - Company/role mismatches between CV and Cover Letter
  - Remaining placeholder text (`[To complete]`, `TODO`, etc.)
  - Bilingual leaks (e.g., English headers or dates inside a German document)
  - ATS keyword placement regressions, stale job analyses, or unverified must-have gaps
  - Cover letter metrics absent from the CV or word counts above posting limits
  - Exact rendered A4 page counts and outdated PDF deliveries
  - Estimated merged PDF bundle sizes exceeding the 2 MB ATS portal cap
  - Clicking any warning jumps directly to the relevant tab and focuses the target field.

---

## 8. Document Templates & Offline `@fontsource` Typography

All templates live in `src/components/templates/` and render identically in the browser preview and Headless Chromium PDF output using **bundled offline `@fontsource` fonts** (`IBM Plex Sans`, `IBM Plex Editorial`, `Plus Jakarta Sans`, `IBM Plex Serif`, `Inter`) with zero external font downloads.

### CV Templates (3)
1. **ATS Clean (`ats-clean`)**: Single-column high-parseability executive CV with clean hierarchy, right-aligned dates, and optional 3:4 portrait header.
2. **Modern Professional (`modern-professional`)**: Contemporary executive header with subtle accent tint band, structured skills layout, and portrait framing support.
3. **DACH Tabular (`dach-tabular`)**: Classic two-column European/German *Lebenslauf* layout separating tabular date columns from role details.

### Cover Letter Templates (3) + STAR Prep
1. **ATS Clean Letter (`ats-letter`)**: Clean single-column business letter with bold subject line and handwritten signature block.
2. **Editorial Sidebar (`editorial-sidebar`)**: Executive two-column layout with a contrast accent sidebar, monogram badge, target role/company metadata, and crisp body column.
3. **DIN 5008 Editorial (`din-editorial`)**: Structured German DIN 5008 business letter with sender line, recipient address block, date alignment, and *Betreffzeile*.
4. **STAR Interview Prep (`StarPrepGuide`)**: Printable A4 guide containing your career arc, structured STAR story cards, objection neutralizers, and interviewer questions.

---

## 9. Strategy, Objection Neutralizers, Outreach & Portal Form Answers

Strategic insights imported from your LLM stay strictly in editor-only tabs and never leak onto printed CVs or cover letters:
- **Recruiter Objection Neutralizers**: Pairs likely recruiter concerns with neutralization talking points and ready-to-use sentences.
- **Salary Positioning**: Stores recommended, safe, and ambitious targets plus negotiation rationale.
- **Portal Form Answers & Outreach**: One-click **Copy Plain Text** buttons speed through Workday, Greenhouse, Personio, and Lever questionnaires and recruiter follow-ups.

---

## 10. ATS Evidence Audit & Keyword Coverage

In the **ATS Audit** tab (`AtsScannerTab` + `RequirementEvidencePanel` + `src/lib/applicationQuality.ts`):
- Verifies that every imported job requirement links to a real quote in the saved job description and real evidence in your Master CV (`direct`, `transferable`, `gap`, or `unknown`).
- Automatically detects if the job description changed after the analysis was generated (*stale analysis* guard).
- Tracks must-have and nice-to-have ATS keywords and flags regressions if a planned keyword is later deleted from its target section.

---

## 11. Dynamic Local PDF Attachments & Tagged Bundle Compiler

Job Application Studio ships with zero personal attachments. To bundle your own recommendation letters, transcripts, or certificates:

1. Drop any `.pdf` files into `public/documents/`.
2. The studio discovers them dynamically via `GET /api/references` (validating safe single-segment filenames, size, and page count).
3. In the editor's **Layout & Assets** tab, check or uncheck which local PDFs to include for each specific application and choose your **Bundle Order**:
   - **DACH Order**: `Cover Letter → CV → Selected Attachments`
   - **ATS Order**: `CV → Cover Letter → Selected Attachments`
4. Click **Export PDF** to compile true searchable, tagged vector PDFs via **Playwright Headless Chromium** (`/api/export-pdf`) and **`pdf-lib` TaggedPdfMerger** (`/api/merge-pdf`):
   - **Individual**: *Download CV*, *Download Cover Letter*, *Download Attachments*, *Download STAR Prep*
   - **Merged Bundles**: *CV + Attachments*, *Cover Letter + Attachments*, *Full Application Bundle*
   - Automatically embeds localized PDF outline bookmarks (`Cover Letter`/`CV` in English, `Anschreiben`/`Lebenslauf` in German, `Carta de presentación`/`Currículum` in Spanish, plus formatted titles for every attached PDF).
   - Warns immediately if the resulting file exceeds **2 MB**, and saves a frozen delivery record so your CRM knows exactly what was exported.

---

## 12. Atomic Storage, Conflict Recovery & Verified Local Backups

- **Atomic File-Locked Writes**: Every JSON save acquires a cross-process lock (`proper-lockfile`), writes to a temporary file, and atomically replaces the target so crashes never corrupt `data/*.json`.
- **Optimistic Revision Protection (`HTTP 409`)**: If the same application or Master CV is modified in another tab, the editor refuses to silently overwrite it, keeps your edits in memory, lets you download an instant JSON backup, and provides a 1-click server reload.
- **Manual Local Backups & Maintenance**:
  - From the Dashboard's **Profile, Default Assets & Local Backups** panel (or via `npm run backup`), create SHA-256 manifest-verified snapshots in `.local/backups`, download a complete portable workspace `.json`, or prune orphaned uploads/temp files.
  - Verify or restore snapshots from the terminal with `npm run backup -- --verify <dir>` or `npm run backup -- --restore <dir>`.
