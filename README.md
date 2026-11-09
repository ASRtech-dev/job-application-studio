# Job Application Studio 🚀

> **A local-first, privacy-focused studio for generating ATS-optimized, high-converting CVs, Cover Letters, and complete job application dossiers.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16+-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0+-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)

---

## 🌟 Highlights

- **100% Local & Private**: No cloud accounts, databases, or third-party tracking. All your resume data stays entirely on your local machine (`data/*.json`).
- **ATS-Optimized & DIN 5008 Compliant**: Pixel-perfect A4 typography engineered to score top percentiles on Applicant Tracking Systems while looking immaculate to human hiring managers.
- **AI Expert Committee Pipeline**: Built-in master prompt generator tailored for LLMs (ChatGPT, Claude, Gemini) to craft customized application JSON files matching specific job postings.
- **Anti-AI Detection Guardrails**: Automated text sanitizer that eliminates repetitive buzzwords, awkward em-dashes, and AI clichés so your documents sound genuine and authoritative.
- **Headless Chromium PDF Export**: Generates vectorized, searchable, high-resolution PDFs using headless Chromium (Playwright) matching exact print dimensions.
- **PDF Merger**: Combines your CV, Cover Letter, and credentials/certificates into a single polished submission PDF.
- **Canvas Digital Signature Pad**: Draw or upload your handwritten signature directly in the browser and stamp it cleanly onto your cover letters.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) version **20.x or higher** installed on your system.

### Option A: 1-Click Installer (Windows)
1. Double-click `Install_Windows.bat` (installs dependencies, seeds sample data, and installs Chromium).
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

## 📖 How It Works

```
   ┌─────────────────────────────────────────────────────────┐
   │ 1. Master CV Profile                                    │
   │    Fill in your verified career history once            │
   └──────────────────────────┬──────────────────────────────┘
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │ 2. AI Prompt Generator                                  │
   │    Paste target job description -> Generate AI prompt   │
   └──────────────────────────┬──────────────────────────────┘
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │ 3. LLM Generation (ChatGPT / Claude / Gemini)           │
   │    Paste prompt into your preferred AI chat             │
   └──────────────────────────┬──────────────────────────────┘
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │ 4. One-Click JSON Import                                │
   │    App sanitizes, validates & generates tailored app    │
   └──────────────────────────┬──────────────────────────────┘
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │ 5. Review & Export Vector PDF                           │
   │    Live preview, edit, sign, and export 1-page / 2-page  │
   └─────────────────────────────────────────────────────────┘
```

1. **Set Up Your Master Profile**: Go to `Master CV` in the top navigation to enter your core experience, education, skills, and contact details.
2. **Target a New Job Opening**: Click **AI Prompt Generator** from the dashboard, choose your language (English, Deutsch, Español) and strategic angle, and paste the job description.
3. **Run Prompt with Your Favorite LLM**: Copy the generated prompt into Claude 3.7 / GPT-4o / Gemini 1.5 Pro. The prompt instructs an expert committee (Hiring Manager, Recruiter, ATS Specialist) to generate a schema-valid JSON application.
4. **Import Application**: Click **New Application → Import JSON**, paste the LLM response, and click Create.
5. **Preview & Export**: Fine-tune your content in the visual editor, select your preferred template (Modern ATS or Executive Sidebar), and click **Export PDF**.

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
│   ├── master-cv.example.json      # Fictional template profile
│   └── applications.example.json   # Sample application entry
├── public/
│   ├── documents/                  # Stored documents and merged PDFs
│   └── uploads/                    # User profile photos and signatures
├── scripts/
│   └── setup.mjs                   # Automated environment & browser setup
├── src/
│   ├── app/                        # Next.js App Router pages and API routes
│   │   ├── api/
│   │   │   ├── applications/       # CRUD endpoints for applications
│   │   │   ├── export-pdf/         # Headless Chromium PDF renderer
│   │   │   ├── master-cv/          # Master candidate profile storage
│   │   │   ├── merge-pdf/          # Multi-document PDF compiler
│   │   │   └── upload/             # Secure asset upload handler
│   │   ├── applications/[id]/      # Interactive application editor & preview
│   │   ├── master-cv/              # Master candidate profile manager
│   │   └── page.tsx                # Dashboard
│   ├── components/
│   │   ├── templates/              # ATS & Executive DIN 5008 document templates
│   │   ├── PromptGeneratorModal.tsx# AI Master prompt builder modal
│   │   └── SignaturePad.tsx        # HTML5 Canvas signature pad
│   └── lib/
│       ├── aiJsonMapper.ts         # Anti-AI sanitizer and schema mapper
│       ├── promptBuilder.ts        # Multi-expert LLM prompt orchestrator
│       ├── schemas.ts              # Zod validation schemas
│       └── storage.ts              # Hardened local file-storage engine
├── next.config.ts                  # CSP and HTTP security headers
├── package.json                    # Dependencies & scripts
└── tsconfig.json                   # TypeScript configuration
```

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Validation**: [Zod](https://zod.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **PDF Engine**: [Playwright](https://playwright.dev/) (Headless Chromium) & [PDF-Lib](https://pdf-lib.js.org/)

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
