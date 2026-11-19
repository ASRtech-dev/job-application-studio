import type { MasterCv } from "./schemas";

/**
 * Fictional sample Master CV profile for first-time setup and demonstration.
 * Replace with your own verified career history on /master-cv.
 */
export const defaultMasterCv: MasterCv = {
  fullName: "Alex Morgan",
  location: "London, United Kingdom",
  email: "alex.morgan@example.com",
  phone: "+44 20 7946 0192",
  links: [
    { label: "LinkedIn", url: "https://www.linkedin.com/in/alex-morgan-example/" },
    { label: "Portfolio", url: "https://alexmorgan.example.com" },
    { label: "GitHub", url: "https://github.com/alex-morgan-example" },
  ],
  availability: "Available with 2 weeks' notice (example)",
  workAuthorization: "Authorized to work in the UK & EU (no sponsorship required)",
  workModes: ["Hybrid", "Remote", "On-site"],
  languages: [
    { language: "English", level: "Native" },
    { language: "German", level: "B2 / Professional" },
    { language: "Spanish", level: "B1 / Conversational" },
  ],
  headlineVariants: [
    {
      category: "Operations & Process Strategy",
      headline: "Senior Operations & Strategy Lead · Process Design · Cross-Functional Delivery",
    },
    {
      category: "Systems & Workflow Delivery",
      headline: "Operations Systems & Automation Specialist · CRM, Analytics & Internal Tools",
    },
    {
      category: "Client & Stakeholder Operations",
      headline: "Client Operations & Implementation Lead · SLA Governance · Partner Onboarding",
    },
  ],
  profileVariants: [
    {
      category: "Operations & Process Strategy",
      text: "Operations and Strategy Lead with 6+ years redesigning cross-functional workflows, scaling service delivery across regional teams, and translating operational data into measurable efficiency gains. Combines structured root-cause analysis and documentation governance with practical CRM and reporting automation.",
    },
    {
      category: "Systems & Workflow Delivery",
      text: "Hands-on Operations Systems Specialist bridging business teams and engineering to turn manual spreadsheets and ticket queues into maintainable automated pipelines. Experienced with CRM architecture, SQL reporting, REST API integrations, and cross-team rollout governance.",
    },
    {
      category: "Client & Stakeholder Operations",
      text: "Client Operations and Implementation Lead experienced in onboarding enterprise partners, maintaining strict service-level targets, and resolving high-priority escalations. Aligns product, operations, and customer stakeholders around clear KPIs and documented playbooks.",
    },
  ],
  achievementsPool: [
    "Redesigned regional service intake and routing workflows, reducing average ticket resolution time by **34%** across 4 operating hubs.",
    "Consolidated fragmented team spreadsheets into an automated KPI reporting pipeline, saving **12 hours/week** of manual reconciliation.",
    "Authored and governed a centralized **60+ playbook** knowledge base with formal review cycles, cutting new-hire ramp time by **25%**.",
    "Led operational onboarding for **8 enterprise accounts**, maintaining **98.5% SLA adherence** during peak seasonal demand.",
    "Identified recurring billing and fulfillment handoff defects through root-cause analysis, lowering rework volume by **28%** within two quarters.",
  ],
  skillsPool: [
    {
      group: "Strategy & Operations",
      skills: [
        "Process Improvement",
        "Workflow Design",
        "Root-Cause Analysis",
        "KPI Reporting",
        "Change Management",
      ],
    },
    {
      group: "Systems & Data",
      skills: [
        "SQL",
        "Python",
        "REST APIs",
        "CRM Administration",
        "Spreadsheet Automation",
      ],
    },
    {
      group: "Delivery & Collaboration",
      skills: [
        "Jira",
        "Confluence",
        "Stakeholder Alignment",
        "Client Onboarding",
        "SLA Governance",
      ],
    },
    {
      group: "Governance & Quality",
      skills: [
        "Quality Assurance",
        "Documentation Standards",
        "GDPR Compliance",
        "Risk Assessment",
        "Process Auditing",
      ],
    },
  ],
  experienceHistory: [
    {
      id: "exp-1",
      jobTitle: "Senior Operations & Strategy Manager",
      company: "Northstar Cloud Ltd.",
      location: "London, United Kingdom",
      dates: "Jan 2023 – Present",
      summary: "",
      include: true,
      bullets: [
        "Redesigned regional customer intake and routing workflows across 4 operating hubs, cutting average ticket resolution time by **34%**.",
        "Built and governed a centralized **60+ playbook** documentation hub with quarterly ownership audits, reducing new-hire onboarding time by **25%**.",
        "Led operational launches for **8 enterprise partner accounts**, maintaining **98.5% SLA adherence** across billing, support, and delivery teams.",
        "Partnered with engineering via **Jira and Confluence** to automate weekly KPI reporting in **SQL and Python**, saving **12 hours/week** of manual effort.",
      ],
      pillars: [
        {
          id: "ops-governance",
          title: "Process Design & Documentation Governance",
          duties: [
            "Maintained end-to-end standard operating procedures and versioned playbooks across four regional service hubs.",
            "Facilitated quarterly process review cycles with department leads to keep workflow maps aligned with policy updates.",
            "Supported internal GDPR and quality-control audits with documented evidence trails.",
          ],
          keywords: ["Process Improvement", "Documentation Standards", "GDPR Compliance", "Playbooks"],
        },
        {
          id: "ops-analytics",
          title: "Operational Analytics & Automation",
          duties: [
            "Built automated SQL and Python KPI reporting views to replace manual spreadsheet consolidation.",
            "Conducted root-cause analyses on recurring ticket escalations and handoff delays across teams.",
          ],
          keywords: ["SQL", "Python", "KPI Reporting", "Root-Cause Analysis"],
        },
        {
          id: "ops-stakeholders",
          title: "Enterprise Onboarding & Stakeholder Alignment",
          duties: [
            "Coordinated cross-functional go-live milestones across support, product, and external client teams.",
            "Presented quarterly operational performance, risk trackers, and ROI proposals to senior leadership.",
          ],
          keywords: ["Client Onboarding", "Stakeholder Alignment", "SLA Governance", "Change Management"],
        },
      ],
      roleFamilies: ["Operations", "Process Strategy", "Systems Delivery"],
      keywords: [
        "Process Improvement",
        "KPI Reporting",
        "SQL",
        "Python",
        "Jira",
        "Confluence",
        "Client Onboarding",
        "SLA Governance",
        "GDPR Compliance",
      ],
    },
    {
      id: "exp-2",
      jobTitle: "Operations Analyst",
      company: "Northstar Cloud Ltd.",
      location: "London, United Kingdom",
      dates: "Mar 2021 – Dec 2022",
      summary: "",
      include: true,
      bullets: [
        "Audited high-volume service and fulfillment queues to surface recurring handoff defects, cutting rework volume by **28%** in two quarters.",
        "Automated weekly SLA variance dashboards using spreadsheet scripts and CRM exports for regional team leads.",
        "Triaged complex cross-team escalations and translated operational bottlenecks into prioritized engineering backlog items.",
      ],
      pillars: [
        {
          id: "analyst-qa",
          title: "Quality Assurance & Root-Cause Diagnostics",
          duties: [
            "Sampled operational workflows against service standards and documented defect trends.",
            "Designed corrective action plans with team managers to close recurring handoff gaps.",
          ],
          keywords: ["Quality Assurance", "Root-Cause Analysis", "Process Auditing"],
        },
      ],
      roleFamilies: ["Operations Analysis", "Quality Assurance"],
      keywords: ["Quality Assurance", "Root-Cause Analysis", "Spreadsheet Automation", "SLA Governance"],
    },
    {
      id: "exp-3",
      jobTitle: "Business Coordinator",
      company: "Meridian Advisory Group",
      location: "Manchester, United Kingdom",
      dates: "Jul 2019 – Feb 2021",
      summary: "",
      include: false,
      bullets: [
        "Coordinated client onboarding schedules, compliance checklists, and delivery milestones for mid-market advisory engagements.",
        "Standardized intake templates and status trackers across 3 consulting practice groups.",
      ],
      roleFamilies: ["Coordination", "Client Operations"],
      keywords: ["Client Onboarding", "Documentation Standards", "Stakeholder Alignment"],
    },
  ],
  projectsHistory: [
    {
      id: "proj-1",
      title: "OpsPulse — Automated SLA & Handoff Monitor",
      role: "Project Lead",
      dates: "2024 – Present",
      description: "Lightweight internal dashboard aggregating ticket queues, SLA alerts, and weekly bottleneck summaries.",
      url: "https://alexmorgan.example.com/opspulse",
      repoUrl: "https://github.com/alex-morgan-example/opspulse",
      techStack: ["Python", "SQL", "REST APIs", "Webhooks"],
      include: true,
      bullets: [
        "Built webhook ingestion and **SQL** summary jobs to flag SLA breaches before daily standups.",
        "Added automated weekly digest exports that reduced manual status preparation by **60%**.",
      ],
    },
    {
      id: "proj-2",
      title: "Onboarding Playbook Generator",
      role: "Creator",
      dates: "2023",
      description: "Template-driven checklist generator for cross-functional enterprise client launches.",
      repoUrl: "https://github.com/alex-morgan-example/playbook-gen",
      techStack: ["JavaScript", "Markdown", "JSON Schema"],
      include: false,
      bullets: [
        "Standardized pre-launch readiness checklists across account management, billing, and support teams.",
      ],
    },
  ],
  educationHistory: [
    {
      id: "edu-1",
      degree: "B.Sc. in Business & Information Systems",
      institution: "University of Manchester",
      period: "2015 – 2019",
      description: "Focus: Operations management, relational databases, and business process modeling.",
    },
  ],
  certificationsHistory: [
    {
      id: "cert-1",
      name: "Lean Six Sigma Green Belt",
      authority: "ASQ",
      date: "May 2022",
      credentialId: "EXAMPLE-LSS-001",
    },
    {
      id: "cert-2",
      name: "Certified Scrum Product Owner (CSPO)",
      authority: "Scrum Alliance",
      date: "Nov 2023",
      credentialId: "EXAMPLE-CSPO-002",
    },
  ],
  specializedCompetencies: [
    "Operational Process Design & Continuous Improvement",
    "Cross-Functional Program & Stakeholder Governance",
    "Data-Driven KPI Steering & Automated Reporting",
    "Privacy-Aware Workflow & Documentation Standards",
  ],
  interviewPrep: {
    careerArcSummary:
      "Started in client coordination at Meridian Advisory Group after studying Business & Information Systems in Manchester, then joined Northstar Cloud in London as an Operations Analyst before being promoted to Senior Operations & Strategy Manager. Focuses on simplifying complex cross-team processes first and backing them with clean reporting and lightweight automation.",
    questionsToAsk: [
      "Which 1–2 recurring handoff bottlenecks would create the highest leverage if resolved in the first 90 days?",
      "How do operations, product, and engineering currently prioritize internal tooling requests?",
      "Which service or efficiency metrics define success for this role at the 6-month mark?",
    ],
    callSurvivalNotes: [
      "Work authorization: Authorized to work in the UK & EU with no sponsorship required (example data — replace with your own).",
      "Availability: 2 weeks' notice period; flexible for interview scheduling.",
    ],
    starStories: [
      {
        title: "Regional Intake & Routing Redesign (-34% Resolution Time)",
        situation: "Four regional hubs used inconsistent ticket categories, causing frequent misrouting and slow escalations.",
        task: "Standardize intake taxonomy and streamline escalation rules without disrupting live support coverage.",
        action: "Audited 3 months of queue data, co-designed a unified category tree with team leads, updated CRM routing rules, and documented 60+ playbooks.",
        result: "Cut average resolution time by 34% and shortened new-hire onboarding ramp by 25%.",
        sourceId: "exp-1",
        keywords: ["Process Improvement", "CRM Administration", "Change Management"],
      },
    ],
  },
};
