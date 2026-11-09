import { MasterCv } from "./schemas";

export interface PromptBuilderOptions {
  targetLanguage: "auto" | "English" | "German" | "Spanish";
  strategyAngle:
    | "auto"
    | "process_operations"
    | "technical_automation"
    | "quality_governance"
    | "leadership_growth";
  companyHint?: string;
  roleTitleHint?: string;
  jobDescription?: string;
  candidateProfile?: MasterCv;
}

const ANGLE_INSTRUCTIONS: Record<PromptBuilderOptions["strategyAngle"], string> = {
  auto: "Analyze the job description and autonomously select the highest-converting positioning angle based on the candidate's verified background.",
  process_operations:
    "Prioritize Business Process Analysis, Operations Steering, KPI Reporting, As-Is/To-Be Mapping (BPMN), and SOP Standardization across operational workflows.",
  technical_automation:
    "Prioritize Workflow Engineering, Automation, API integrations, scripting, tool orchestration (n8n, Make, Python), and replacing manual reports with automated pipelines.",
  quality_governance:
    "Prioritize Process Compliance Auditing, Quality Assurance Reporting, Risk Mitigation, Root-Cause Analysis, Lean Six Sigma methodologies, and SOP Governance.",
  leadership_growth:
    "Prioritize Cross-functional Coordination, Stakeholder Management, Service Delivery Execution, and Operational Enablement.",
};

function formatTodayLabel(lang: PromptBuilderOptions["targetLanguage"]): string {
  const now = new Date();
  if (lang === "German") return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }).format(now);
  if (lang === "Spanish") return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(now);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(now);
}

export function buildExpertCommitteePrompt(options: PromptBuilderOptions): string {
  const todayLabel = formatTodayLabel(options.targetLanguage);
  const profile = options.candidateProfile;
  const candidateName = profile?.fullName || "The Candidate";

  const localized = {
    English: { closing: "Kind regards,", sidebar: "COVER LETTER", greeting: "Dear [Company Name] Hiring Team,", city: profile?.location?.split(",")[0]?.trim() || "City" },
    German: { closing: "Mit freundlichen Grüßen", sidebar: "ANSCHREIBEN", greeting: "Sehr geehrtes [Company Name]-Team,", city: profile?.location?.split(",")[0]?.trim() || "Stadt" },
    Spanish: { closing: "Atentamente,", sidebar: "CARTA DE PRESENTACIÓN", greeting: "Estimado equipo de [Company Name]:", city: profile?.location?.split(",")[0]?.trim() || "Ciudad" },
  } as const;

  const skeletonLang = options.targetLanguage === "auto" ? null : localized[options.targetLanguage];
  const skLanguage = options.targetLanguage === "auto" ? "English | German | Spanish" : options.targetLanguage;
  const skClosing = skeletonLang ? skeletonLang.closing : "Kind regards, | Mit freundlichen Grüßen | Atentamente,";
  const skSidebar = skeletonLang ? skeletonLang.sidebar : "COVER LETTER | ANSCHREIBEN | CARTA DE PRESENTACIÓN";
  const skGreeting = skeletonLang ? skeletonLang.greeting : "Greeting in document language addressed to the hiring team";

  const langInstruction =
    options.targetLanguage === "auto"
      ? `Detect the primary language of the Job Description. Set "language" to exactly "English", "German", or "Spanish", and write 100% of the CV and Cover Letter content in that single language without mixing languages.`
      : `Set "language" to "${options.targetLanguage}" and write 100% of the CV and Cover Letter strictly in ${options.targetLanguage} (zero language mixing).`;

  const angleInstruction = ANGLE_INSTRUCTIONS[options.strategyAngle];

  const jobHeaderHint =
    options.companyHint || options.roleTitleHint
      ? `\n- Target Company Hint: ${options.companyHint || "(Extract from Job Description)"}\n- Target Role Hint: ${options.roleTitleHint || "(Extract from Job Description)"}`
      : "";

  const jdContent = options.jobDescription?.trim()
    ? options.jobDescription.trim()
    : "[PASTE JOB DESCRIPTION HERE]";

  // Build dynamic dossier text from MasterCv
  let dossierText = `- **Candidate Name**: ${candidateName}\n- **Location**: ${profile?.location || "City, Country"}\n- **Email**: ${profile?.email || "candidate@example.com"}\n- **Phone**: ${profile?.phone || ""}\n`;
  if (profile?.links && profile.links.length > 0) {
    dossierText += `- **Links**: ${profile.links.map((l) => `${l.label}: ${l.url}`).join(" | ")}\n`;
  }
  if (profile?.languages && profile.languages.length > 0) {
    dossierText += `- **Languages**: ${profile.languages.map((l) => `${l.language} (${l.level})`).join(" | ")}\n`;
  }
  if (profile?.educationHistory && profile.educationHistory.length > 0) {
    dossierText += `\n### Verified Education:\n` + profile.educationHistory.map((e) => `- **${e.id}**: ${e.degree} — ${e.institution} (${e.period})${e.description ? ` — ${e.description}` : ""}`).join("\n");
  }
  if (profile?.certificationsHistory && profile.certificationsHistory.length > 0) {
    dossierText += `\n### Verified Certifications:\n` + profile.certificationsHistory.map((c) => `- ${c.name}${c.authority ? ` (${c.authority})` : ""}`).join("\n");
  }
  if (profile?.achievementsPool && profile.achievementsPool.length > 0) {
    dossierText += `\n### Verified Quantitative Achievements Pool:\n` + profile.achievementsPool.map((a) => `- ${a}`).join("\n");
  }
  if (profile?.experienceHistory && profile.experienceHistory.length > 0) {
    dossierText += `\n### Verified Chronological Experience:\n` + profile.experienceHistory.map((exp) => `1. **\`id: "${exp.id}"\` | ${exp.jobTitle} — ${exp.company}** (\`${exp.location}\` | \`${exp.dates}\`):\n${exp.bullets.map((b) => `   - ${b}`).join("\n")}`).join("\n");
  }
  if (profile?.projectsHistory && profile.projectsHistory.length > 0) {
    dossierText += `\n### Verified Projects Catalog:\n` + profile.projectsHistory.map((proj) => `1. **\`id: "${proj.id}"\` | ${proj.title}** (\`role: "${proj.role}"\` | \`dates: "${proj.dates}"\`):\n   - ${proj.description}\n${(proj.bullets || []).map((b) => `   - ${b}`).join("\n")}`).join("\n");
  }

  return `You are an elite **Executive Hiring & ATS Optimization Committee** composed of **4 Specialized Experts** working in concert to analyze a job offer and compile a **clean, human-written, minimalist, high-converting application package** in **strict JSON format** for **${candidateName}**:

1. **Expert 1 — Senior Tech & Operations Recruiter**:
   - Evaluates role fit (\`0.0\` to \`10.0\`), classifies the role (\`coreTarget\`, \`bridgeRole\`, \`stretchRole\`, \`stabilityRole\`, or \`alternativeRole\`), defines realistic salary positioning, drafts natural portal answers (\`formFieldAnswers\`), and prepares honest objection neutralizers (\`recruiterConcernHandling\`).
   - Enforces the **6-Second Human Scan Test**: Recruiters reject bloated walls of text that smell like ChatGPT. Every sentence must sound like a sharp, grounded human operator wrote it—short, dry, specific, and zero corporate fluff.
2. **Expert 2 — Senior ATS & Semantic Keyword Architect**:
   - Extracts exact \`mustIncludeATSKeywords\`, \`niceToHaveKeywords\`, \`humanNarrativeKeywords\`, and \`avoidOrMinimizeKeywords\`.
   - Integrates top keywords naturally into \`coreSkills\` (strictly capped at **4 groups × 5 skills = 20 skills total**) and into concise experience bullets without keyword stuffing.
3. **Expert 3 — Minimalist Editorial & A4 Print Director**:
   - Enforces the **Clean Executive CV Budget (\`360–430 words total across the entire CV\`)** so the PDF has generous whitespace, zero clutter, and 1-line bullets.
   - Enforces **Zero Duplication** between \`keyAchievements\` and \`experience\`, and applies restrained \`**bold**\` emphasis to **at most 1 short metric or deliverable per bullet** (1–3 words max). Never bold multiple fragments per sentence.
4. **Expert 4 — Factual Truthfulness & Schema QA Auditor**:
   - Verifies 100% factual fidelity against the **Immutable Candidate Dossier** below. Never invents degrees, employers, dates, certifications, or unverified tools.
   - Enforces strict JSON schema compliance, canonical \`id\` values, exact enum literals, and zero Markdown links \`[url](url)\`.

---

## SECTION 1: IMMUTABLE CANDIDATE DOSSIER (GROUND-TRUTH MASTER CV)

Use **ONLY** the verified facts below. You may select, prioritize, translate, and align terminology to match the Job Description when truthful, but you must **NEVER** invent unsupported claims:

${dossierText}

---

## SECTION 2: HARD ANTI-AI WRITING, CLEANLINESS & EDITORIAL RULES

1. **Human Voice & Anti-AI Detox**:
   - **BANNED AI BUZZWORDS**: Never use words like *"spearheaded"*, *"orchestrated"*, *"synergized"*, *"leveraged"*, *"fostered"*, *"delved"*, *"pivotal"*, *"testament"*, *"seamlessly"*, *"holistic"*, *"cutting-edge"*, or *"dynamic"*.
   - **USE PLAIN, DIRECT HUMAN VERBS**: Start bullets with concrete verbs: *Built, Automated, Cut, Audited, Standardized, Mapped, Resolved, Designed, Replaced, Delivered*.
   - **NO GERUND CHAINS AT THE END OF BULLETS**: Never write *"Did X, reducing Z by 70% while improving A, aligning B, and ensuring C."* State **one concrete action + one clear result**, then stop.
   - **1-LINE BULLET RULE**: Every bullet in the CV must be **12 to 16 words maximum** (strictly 1 visual line on A4).
   - **RESTRAINED BOLDING**: Bold **at most ONE short metric or noun phrase (1–3 words)** per bullet using \`**...**\`.

2. **Clean Executive Density Budget (360–430 WORDS TOTAL)**:
   - \`headline\`: **50 to 78 characters** (3 or 4 clean segments separated by \` · \`).
   - \`professionalProfile\`: **2 crisp sentences (\`38–52 words\` maximum)**.
   - \`keyAchievements\`: **Exactly 3 ultra-short KPI snapshots (\`10–14 words\` each)**. Focus purely on headline metrics. **NEVER repeat the same phrasing in \`experience\`**.
   - \`coreSkills\`: **Exactly 4 groups × 5 atomic skills (\`20 skills total\`)**. Group titles \`≤ 24 chars\`; each skill \`1–3 words\`. No pipes \`|\`.
   - \`experience\`: Always preserve canonical \`id\` values. Bullet budget: recent role (3-4 bullets), earlier roles (1-2 bullets).
   - \`coverLetter\`: Exactly 5 concise paragraphs (240 to 290 words total): opening, evidence, fit, contribution, closing.

3. **Language & Monolingual Lock**:
   - ${langInstruction}

4. **Strategic Positioning Focus**:
   - ${angleInstruction}${jobHeaderHint}

---

## SECTION 3: REQUIRED OUTPUT JSON SCHEMA

Return **EXCLUSIVELY** a single valid JSON object (RFC 8259) matching the exact structure below. Do not include any introductory text or explanation outside the JSON code block:

\`\`\`json
{
  "company": "Clean Company Name",
  "roleTitle": "Clean Role Title",
  "jobLocation": "City, Country / Remote",
  "workModel": "Remote | Hybrid | On-site",
  "language": "${skLanguage}",
  "roleClassification": {
    "type": "coreTarget | bridgeRole | stretchRole | stabilityRole | alternativeRole",
    "seniorityLevel": "entry | junior | mid | mid-senior | senior | lead | executive | unclear",
    "roleFamily": "Short role family description",
    "applicationPriority": "low | medium | high | strategic",
    "outputMode": "fast | standard | premium",
    "recommendedPositioning": "Strategic positioning summary.",
    "cvIntensity": "Light | Medium | Strong | Technical-Dense",
    "overqualificationRisk": "Low | Medium | High",
    "dealBreakerRisk": "Low | Medium | High"
  },
  "headline": "Target Role Title · Core Domain · Core Methodology · Core Tech",
  "professionalProfile": "2 crisp sentences (38-52 words max) combining verified domain experience with target alignment.",
  "keyAchievements": [
    "3 ultra-short 1-line KPI snapshots (10-14 words each, max 1 bold metric per item, zero duplication with experience)."
  ],
  "coreSkills": [
    {
      "group": "Group Name (4 groups total)",
      "skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5"]
    }
  ],
  "experience": [
    {
      "id": "exp-1",
      "company": "Company Name",
      "jobTitle": "Job Title",
      "location": "City, Country",
      "dates": "Start – End",
      "summary": "",
      "include": true,
      "bullets": [
        "Crisp 1-line bullet showing concrete operational & technical execution."
      ]
    }
  ],
  "projects": [
    {
      "id": "proj-1",
      "title": "Project Title",
      "role": "Role Title",
      "dates": "Dates",
      "description": "Short description.",
      "include": true,
      "bullets": [
        "Crisp bullet detailing outcomes."
      ]
    }
  ],
  "education": [
    {
      "id": "edu-1",
      "degree": "Degree Title",
      "institution": "Institution",
      "period": "Period",
      "description": "Short description"
    }
  ],
  "coverLetter": {
    "positioningLine": "Refined 3-4 segment headline",
    "dateLine": "${skeletonLang ? skeletonLang.city : "City"}, ${todayLabel}",
    "greeting": "${skGreeting}",
    "paragraphs": [
      { "type": "opening", "text": "Hook connecting candidate to company mission." },
      { "type": "evidence", "text": "Concrete verified impact from experience." },
      { "type": "fit", "text": "Skills and methodological alignment." },
      { "type": "contribution", "text": "Concrete value delivery in first 90 days." },
      { "type": "closing", "text": "Clean call to action and availability." }
    ],
    "closingPhrase": "${skClosing}",
    "signatureName": "${candidateName}",
    "sidebarLabel": "${skSidebar}",
    "sidebarRole": "Clean Role Title",
    "sidebarCompany": "Clean Company Name"
  },
  "formFieldAnswers": {
    "shortMotivationMessage": "Natural motivation message.",
    "whyThisRole": "Why this role fits.",
    "whyThisCompany": "Why this company resonates.",
    "additionalMessage": "Key strengths and availability.",
    "availability": "Available immediately",
    "degreeExplanation": "Degree summary.",
    "workPermitGermany": "Yes",
    "website": "",
    "linkedin": ""
  },
  "salaryPositioning": {
    "recommendedRangeEUR": "e.g. 60,000 – 70,000 EUR",
    "safeNumberEUR": "e.g. 65,000 EUR",
    "ambitiousNumberEUR": "e.g. 72,000 EUR",
    "riskComment": "Market assessment."
  },
  "keywordStrategy": {
    "mustIncludeATSKeywords": ["Keyword 1", "Keyword 2"],
    "niceToHaveKeywords": ["Keyword 3"],
    "humanNarrativeKeywords": ["Narrative 1"],
    "avoidOrMinimizeKeywords": ["Avoid 1"]
  },
  "recruiterConcernHandling": {
    "likelyConcerns": [
      {
        "concern": "Potential question mark.",
        "howToNeutralize": "Strategy to address.",
        "sentenceToUse": "Sentence to use in conversation."
      }
    ]
  },
  "fitAssessment": {
    "scoreOutOf10": 8.5,
    "probabilityTier": "High",
    "summary": "Assessment of fit.",
    "bestAngles": ["Angle 1", "Angle 2"],
    "mainRisks": ["Risk 1"],
    "recommendedApplicationStrategy": "Strategy.",
    "recommendedTone": "Direct, human, evidence-driven.",
    "recommendedCVVersion": "ATS Clean",
    "applyOrSkip": "Apply"
  },
  "qualityControl": {
    "directEvidenceUsed": ["Direct evidence"],
    "transferableEvidenceUsed": ["Transferable evidence"],
    "adaptableSkillsUsed": ["Adjacent skill"],
    "potentialOverclaimsAvoided": ["Confirmed truthful"],
    "atsKeywordsIncluded": ["Included keyword"],
    "humanRecruiterImpression": "Impression on hiring manager.",
    "finalContentRisk": "Low",
    "oneSentencePositioning": "Punchy positioning sentence."
  }
}
\`\`\`

---

## SECTION 4: TARGET JOB DESCRIPTION TO ANALYZE

${jdContent}`;
}
