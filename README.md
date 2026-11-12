# Job Application Studio 🚀

> **A local-first, privacy-focused studio for generating ATS-optimized, high-converting CVs, DIN 5008 Cover Letters, and complete job application dossiers.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16+-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0+-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)

---

## 🌟 Highlights

- **100% Local & Private**: No cloud accounts, external databases, or third-party tracking. All your resume data stays entirely on your local machine (`data/*.json`).
- **DACH 3:4 Executive Portrait & DIN 5008 Layouts**: Engineered by an executive CV design committee with a 3:4 *Bewerbungsfoto* frame, subtle gallery mat, and pixel-perfect A4 typography that scores top percentiles on ATS parsers (`Workday`, `Greenhouse`, `Personio`, `Lever`).
- **5-Expert AI Prompt Customization Studio**: Built-in master prompt generator for LLMs (`Gemini 2.5 Pro`, `Claude 3.7 Sonnet`, `ChatGPT`) with customizable positioning angles, seniority tone calibration, target CV density, and interactive career highlight toggles.
- **Anti-AI Detection & Duplication Guardrails**: Automated text sanitizer (`aiJsonMapper.ts`) that eliminates robotic em-dashes, AI clichés, and duplicate bullets between Key Achievements and Experience.
- **Berlin Editorial Readiness Toolbar**: Live word-budget gauge (`330–460w`), bullet conciseness monitor, 1-Click AI Cleaner, section visibility toggles, and **1-Click Smart Auto-Fit**.
- **Headless Chromium Vector PDF Compiler & Merger**: Generates searchable, high-resolution vector PDFs and merges your Cover Letter, CV, and Certificates/References into a single DACH *Bewerbungsmappe* PDF bundle.

> 📚 **Want a deep dive into every module?** Read the complete [**FEATURE_GUIDE.md**](./FEATURE_GUIDE.md).

---

## 🚀 Quick Start & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) version **20.x or higher** installed on your system.

### Option A: 1-Click Installer (Windows)
1. Double-click `Install_Windows.bat` (installs dependencies, seeds sample data, and installs Playwright Chromium).
2. Double-click `Start_App.bat` to launch the studio.
3. Your browser will automatically open [http://127.0.0.1:3000](http://127.0.0.1:3000).

### Option B: 1-Click Installer (Linux / macOS)
```bash
chmod +x install.sh start.sh
./install.sh
./start.sh
```

### Option C: Manual Installation
```bash
# 1. Install dependencies
npm install

# 2. Run initialization setup (seeds template data and installs Playwright Chromium)
npm run setup

# 3. Start local development server
npm run dev
```

Visit [http://127.0.0.1:3000](http://127.0.0.1:3000) in your web browser.

---

## 📖 Concise User Guide: How to Use the Program (5-Step Workflow)

```
   ┌───────────────────────────────────────────────────────────────┐
   │ STEP 1: Master CV & Global Assets                             │
   │ Configure your verified career history, 3:4 photo & signature │
   └──────────────────────────────┬────────────────────────────────┘
                                  ▼
   ┌───────────────────────────────────────────────────────────────┐
   │ STEP 2: AI Prompt Studio (5-Expert Committee)                 │
   │ Select language, angle, tone, density & priority highlights   │
   └──────────────────────────────┬────────────────────────────────┘
                                  ▼
   ┌───────────────────────────────────────────────────────────────┐
   │ STEP 3: Generate Tailored JSON in Your LLM                    │
   │ Paste the prompt into Gemini / Claude / ChatGPT               │
   └──────────────────────────────┬────────────────────────────────┘
                                  ▼
   ┌───────────────────────────────────────────────────────────────┐
   │ STEP 4: 1-Click JSON Import & Anti-AI Sanitization            │
   │ Import JSON -> Auto-clean clichés -> Auto-fit A4 pagination   │
   └──────────────────────────────┬────────────────────────────────┘
                                  ▼
   ┌───────────────────────────────────────────────────────────────┐
   │ STEP 5: Live Split-Screen Review & Vector PDF Export          │
   │ Fine-tune CV/Letter/STAR Prep, copy portal answers & export   │
   └───────────────────────────────────────────────────────────────┘
```

### Step 1: Configure Your Master CV & Global Assets
1. On the **Dashboard (`/`)**, click **`Edit Master`** inside the *Master CV* card.
2. Fill in your verified contact details, headline variants, achievements library, categorized skills, chronological work experience, and projects, then click **`Save Master Data`**.
3. Back on the Dashboard under **Default Assets**:
   - Upload your **Profile Photo** (rendered automatically as a balanced **3:4 Executive Portrait**) and toggle the checkbox to enable it by default.
   - Upload a transparent **Handwritten Signature** or click **`✏️ Or Draw Signature In-App`** to sign directly on the canvas.

### Step 2: Generate a Tailored Prompt in the AI Prompt Studio
1. Click **`AI Prompt Studio`** in the top navigation bar (or **`Prompt Builder`** inside any draft).
2. Configure the **5-Expert Committee** parameters for your target job:
   - **Output Language**: `Auto-detect`, `English`, `Deutsch (DACH)`, or `Español`.
   - **Primary Positioning Angle**: Choose the domain lens that best fits the role (e.g., *AI Agents & Automation*, *Business Process & BPMN 2.0*, *Lean Six Sigma Steering*, *Technical Operations & Jira*, or *Regulatory Governance*).
   - **Seniority & Tone Calibration**: Select *Hands-On Builder*, *Internal Consultant*, or *Executive Operations*.
   - **Target CV Density**: Choose *Executive 2-Page (Recommended)*, *Ultra-Compact 1-Page*, or *Comprehensive Technical*.
   - **Priority Career Highlights**: Toggle **2 to 5 core milestones** you want the LLM to emphasize.
3. Paste the target **Job Description** into field #7 and click **`Copy Personalized Prompt`**.

### Step 3: Run the Prompt in Gemini, Claude, or ChatGPT
1. Paste the copied prompt into your preferred LLM (e.g., Gemini 2.5 Pro, Claude 3.7 Sonnet, or GPT-4o).
2. The LLM will analyze the job posting against your Master CV and output a single RFC 8259 `.json` block containing your tailored CV, DIN 5008 Cover Letter, ATS Keyword Strategy, Fit Score, Recruiter Objection Neutralizers, Portal Form Answers, and STAR Interview Guide.

### Step 4: Import the Tailored JSON Draft
1. On the Dashboard, click **`+ New Application`** → switch to the **`Import JSON`** tab (or click **`Import JSON`** inside an existing draft).
2. Upload the `.json` file or paste the JSON string directly.
3. Review the instant validation preview (*Company*, *Role*, *Fit Score / 10*, *Recommended Positioning*) and click **`Import & Create`**.
4. The studio automatically normalizes the schema, strips AI buzzwords/em-dashes, removes duplicate bullets, and applies Smart A4 Auto-Fit.

### Step 5: Fine-Tune, Copy Portal Answers & Export Vector PDFs
Inside the **Split-Screen Application Editor (`/applications/[id]`)**:
- **Use the Top Readiness Toolbar**:
  - Check your **Word Count Badge** (`330–460w Ideal`) and **Bullet Conciseness**.
  - Click **`🧹 Clean AI`** if any AI buzzwords are flagged, or **`✨ Auto-Fit`** to automatically balance A4 typography.
  - Toggle **`Achievements: ON/OFF`** or **`Projects: ON/OFF`** on the fly.
- **Customize Layout & Portrait Framing (`Layout & Assets` tab)**:
  - Switch between **ATS Clean** and **Modern Professional** CV templates, or **ASR Sidebar** and **ATS Letter** cover letter templates.
  - Choose your **Portrait Frame Style**: *Executive Portrait 3:4 (Recommended)*, *Modern Squircle (1:1)*, or *Studio Circle (1:1)*.
- **Speed Through Portal Applications (`📝 Form Answers` & `🔍 ATS Scanner` tabs)**:
  - Use 1-click **`Copy Plain Text`** buttons for *Why this Role?*, *Why this Company?*, *Short Motivation*, and *Salary Positioning*.
  - Paste the job ad in **`🔍 ATS Scanner`** to verify your keyword match percentage (`0%–100%`).
- **Export Print-Ready PDFs (`Export PDF` dropdown)**:
  - Download individual **CV**, **Cover Letter**, or **STAR Interview Prep** PDFs.
  - Or choose **`Full Application Bundle`** under *Merged Bundles* to compile `Cover Letter + CV + References/Certificates` (`public/documents/references.pdf`) into a single unified PDF named `Candidate_Name_Application_Bundle_Company.pdf`.

---

## 🔒 Security & Privacy by Design

- **Path Traversal Protection**: All filesystem reads and writes enforce canonical directory boundary checks.
- **SSRF & Local File Isolation**: Playwright Chromium exports strictly block non-HTTP internal protocols (`file://`, `javascript:`).
- **Strict Content Security Policy (CSP)**: Hardened headers with `default-src 'self'`, `frame-ancestors 'none'`, and secure MIME type sniffing prevention.
- **Safe File Uploads**: Image uploads are restricted to 5MB and validated against magic byte signatures (`image/png`, `image/jpeg`, `image/webp`).
- **No Telemetry**: Zero external tracking scripts or analytics.

---

## 📂 Project Structure

```
job-application-studio/
├── data/
│   ├── master-cv.example.json      # Sample candidate profile template
│   └── applications.example.json   # Sample application entry
├── public/
│   ├── documents/                  # Stored reference PDFs for bundle merging
│   └── uploads/                    # Local user profile photos and signatures
├── scripts/
│   └── setup.mjs                   # Automated environment & Chromium setup
├── src/
│   ├── app/                        # Next.js App Router pages and API routes
│   │   ├── api/
│   │   │   ├── applications/       # CRUD endpoints for applications
│   │   │   ├── export-pdf/         # Singleton Headless Chromium PDF renderer
│   │   │   ├── master-cv/          # Master candidate profile storage
│   │   │   ├── merge-pdf/          # Multi-document PDF compiler (pdf-lib)
│   │   │   └── upload/             # Magic-byte validated asset upload handler
│   │   ├── applications/[id]/      # Split-screen application editor & A4 preview
│   │   ├── master-cv/              # Master candidate profile manager
│   │   └── page.tsx                # Applications Dashboard & Pipeline KPIs
│   ├── components/
│   │   ├── templates/              # ATS Clean, Modern, DIN 5008 Sidebar & STAR templates
│   │   ├── PromptGeneratorModal.tsx# 5-Expert AI Master Prompt Customization Studio
│   │   └── SignaturePad.tsx        # HTML5 Canvas signature drawing pad
│   └── lib/
│       ├── aiJsonMapper.ts         # Anti-AI sanitizer, deduplicator & schema mapper
│       ├── promptBuilder.ts        # 5-Expert LLM prompt orchestrator
│       ├── schemas.ts              # Strict Zod validation schemas
│       └── storage.ts              # Hardened local file-storage engine
├── FEATURE_GUIDE.md                # Comprehensive guide to every studio feature
├── next.config.ts                  # CSP and HTTP security headers
├── package.json                    # Dependencies & scripts
└── tsconfig.json                   # TypeScript configuration
```

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, React 19)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Validation**: [Zod 4](https://zod.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **PDF Engine**: [Playwright](https://playwright.dev/) (Headless Chromium) & [pdf-lib](https://pdf-lib.js.org/)

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
