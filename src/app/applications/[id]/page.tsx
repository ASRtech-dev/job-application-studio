"use client";

import React, { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Download, Eye, Edit3, Settings, Sparkles, Check, FileText, Settings2, Image as ImageIcon, ChevronDown, Package, Trash2, Plus } from "lucide-react";
import confetti from "canvas-confetti";
import { Application, SkillGroup, ExperienceEntry, CoverLetterParagraph } from "@/lib/schemas";
import { AtsCleanCv, ModernProfessionalCv, AtsLetter, AsrSidebarLetter, StarPrepGuide } from "@/components/templates/DocumentTemplates";
import SignaturePad from "@/components/SignaturePad";
import PromptGeneratorModal from "@/components/PromptGeneratorModal";
import { normalizeImportedAIJson, sanitizeApplicationAiContent, computeSmartAutoFitSettings, analyzeApplicationReadiness } from "@/lib/aiJsonMapper";
import { buildExpertCommitteePrompt } from "@/lib/promptBuilder";

export default function ApplicationEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showSigPad, setShowSigPad] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [showExportJsonMenu, setShowExportJsonMenu] = useState(false);
  const exportJsonMenuRef = useRef<HTMLDivElement>(null);

  // Editor Import validation
  const [editorJsonText, setEditorJsonText] = useState("");
  const [editorValidationSummary, setEditorValidationSummary] = useState<{
    valid: boolean;
    company?: string;
    roleTitle?: string;
    fitScore?: number | null;
    priority?: string;
    positioning?: string;
    errors?: string[];
  } | null>(null);
  
  // UI Tabs
  const [activeInputTab, setActiveInputTab] = useState<"cv-profile" | "cv-exp" | "cv-projects" | "cv-skills" | "cover-letter" | "assets" | "tracking" | "ats-scanner" | "strategy" | "form-answers">("cv-profile");
  const [activePreviewTab, setActivePreviewTab] = useState<"cv" | "letter" | "prep">("cv");
  
  // Real-time zoom level of preview pane
  const [zoomScale, setZoomScale] = useState(0.7);

  // Load application details
  useEffect(() => {
    async function loadApp() {
      try {
        const res = await fetch(`/api/applications/${id}`);
        if (!res.ok) throw new Error("Failed to load application");
        const json = await res.json();
        setApp(json);

        // Load asset defaults from localStorage if they aren't configured yet
        const defaultSig = localStorage.getItem("asr_default_sig");
        const defaultPhoto = localStorage.getItem("asr_default_photo");
        const sigEnabled = localStorage.getItem("asr_sig_enabled") === "true";
        const photoEnabled = localStorage.getItem("asr_photo_enabled") === "true";

        let modified = false;
        const updatedApp = { ...json };

        if (!updatedApp.assetSettings.signature.filePath && defaultSig) {
          updatedApp.assetSettings.signature.filePath = defaultSig;
          updatedApp.assetSettings.signature.enabled = sigEnabled;
          modified = true;
        }
        if (!updatedApp.assetSettings.photo.filePath && defaultPhoto) {
          updatedApp.assetSettings.photo.filePath = defaultPhoto;
          updatedApp.assetSettings.photo.enabled = photoEnabled;
          modified = true;
        }

        if (modified) {
          setApp(updatedApp);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to load application details.");
      } finally {
        setLoading(false);
      }
    }
    loadApp();
  }, [id]);

  const handleSave = async (silent = false) => {
    if (!app) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(app)
      });
      if (res.ok) {
        if (!silent) {
          confetti({
            particleCount: 50,
            spread: 40,
            origin: { y: 0.8 }
          });
          alert("Draft saved successfully!");
        }
      } else {
        alert("Failed to save draft.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDrawnSignature = async (blob: Blob) => {
    if (!app) return;
    setShowSigPad(false);
    setExporting(true); // show spinner

    const file = new File([blob], "drawn_signature.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "signature");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        // Save globally
        localStorage.setItem("asr_default_sig", data.url);
        localStorage.setItem("asr_sig_enabled", "true");
        // Update current application state
        setApp({
          ...app,
          assetSettings: {
            ...app.assetSettings,
            signature: {
              ...app.assetSettings.signature,
              enabled: true,
              filePath: data.url
            }
          }
        });
        
        confetti({
          particleCount: 50,
          spread: 40,
          origin: { y: 0.8 }
        });
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving drawn signature.");
    } finally {
      setExporting(false);
    }
  };

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
      if (exportJsonMenuRef.current && !exportJsonMenuRef.current.contains(e.target as Node)) {
        setShowExportJsonMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Validation effect for JSON text pasted inside editor's import modal
  useEffect(() => {
    if (!editorJsonText.trim()) {
      setEditorValidationSummary(null);
      return;
    }
    try {
      const parsed = JSON.parse(editorJsonText);
      const errors: string[] = [];
      const comp = parsed.company || parsed.cvContent?.header?.company || "";
      const role = parsed.roleTitle || parsed.cvContent?.header?.headline || "";
      
      const fitObj = parsed.fitAssessment || parsed.fit || parsed.fitScore;
      const fitScore = fitObj?.scoreOutOf10 !== undefined ? fitObj.scoreOutOf10 : null;
      
      const classObj = parsed.roleClassification || parsed.classification;
      const priority = classObj?.applicationPriority || "";
      const positioning = classObj?.recommendedPositioning || "";

      if (!comp && !parsed.cvContent) errors.push("Missing 'company' name or 'cvContent' root.");
      
      setEditorValidationSummary({
        valid: errors.length === 0,
        company: comp,
        roleTitle: role,
        fitScore,
        priority,
        positioning,
        errors
      });
    } catch (err: any) {
      setEditorValidationSummary({
        valid: false,
        errors: ["JSON Syntax Error: " + err.message]
      });
    }
  }, [editorJsonText]);

  const handleImportJson = (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!app) return;

      const updated = normalizeImportedAIJson(parsed, app, jsonText);

      setApp(updated);
      setEditorJsonText(""); // clear editor input state
      setShowImportModal(false);
      
      confetti({
        particleCount: 80,
        spread: 50,
        origin: { y: 0.6 }
      });
      
      alert("JSON imported successfully! Review the changes in the live preview and click 'Save Draft' to persist them.");
    } catch (e: any) {
      alert("Error processing JSON file: " + e.message);
    }
  };

  // Build styled HTML for a given document type
  const buildStyledHtml = (docType: "cv" | "letter" | "prep"): string | null => {
    if (!app) return null;

    const elementId = docType === "cv"
      ? (app.templateSettings.cvTemplate === "ats-clean" ? "cv-template-ats" : "cv-template-modern")
      : docType === "letter"
      ? (app.templateSettings.coverLetterTemplate === "ats-letter" ? "letter-template-ats" : "letter-template-asr")
      : "prep-template-star";

    const element = document.getElementById(elementId);
    if (!element) return null;

    const isSidebarTemplate = docType === "letter" && app.templateSettings.coverLetterTemplate === "asr-sidebar";
    const pageMarginCss = isSidebarTemplate
      ? `@page { size: A4; margin: 0; }`
      : `@page { size: A4; margin: 15mm 16mm; }`;

    const printOverrideCss = !isSidebarTemplate
      ? `
        #cv-template-ats, #cv-template-modern, #letter-template-ats, #prep-template-star {
          padding: 0 !important;
          margin: 0 !important;
          width: 100% !important;
          min-height: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
      `
      : `
        #letter-template-asr {
          margin: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
      `;

    const fontFamily = app.templateSettings?.fontFamily || "Inter";
    const fontLink = `<link href="https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, "+")}:wght@300;400;500;600;700&display=swap" rel="stylesheet" />`;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          ${fontLink}
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            ul {
              padding-left: 16px;
            }
            body {
              margin: 0;
              padding: 0;
              background-color: white;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              text-rendering: geometricPrecision;
              font-variant-ligatures: none;
              font-feature-settings: "liga" 0, "clig" 0;
            }
            ${pageMarginCss}
            ${printOverrideCss}
            .break-avoid, .signature-block, .project-entry, li {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            p, ul {
              orphans: 2;
              widows: 2;
            }
            h2, h3 {
              break-after: avoid !important;
              page-break-after: avoid !important;
            }
            .page-break-indicator {
              display: none !important;
            }
          </style>
        </head>
        <body>
          ${element.outerHTML}
        </body>
      </html>
    `;
  };

  // Generate a clean, highly professional filename based on candidate name, doc type, and company/role
  const getProfessionalFilename = (docType: string) => {
    if (!app) return "";
    
    // 1. Candidate name: "Alex Morgan" -> "Alex_Morgan"
    const fullName = app.cvContent?.header?.fullName || "Candidate";
    const cleanName = fullName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-zA-Z0-9\s-]/g, "") // Remove special characters
      .trim()
      .replace(/\s+/g, "_");

    // 2. Company name: "Zalando" -> "Zalando"
    const cleanCompany = (app.company || "Generic")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    // 3. Document type label
    let docLabel = "CV";
    if (docType === "letter") {
      docLabel = "Cover_Letter";
    } else if (docType === "prep") {
      docLabel = "STAR_Prep";
    } else if (docType === "cv-refs") {
      docLabel = "CV_References";
    } else if (docType === "full-bundle") {
      docLabel = "Application_Bundle";
    } else if (docType === "references") {
      docLabel = "References";
    } else if (docType === "letter-refs") {
      docLabel = "Cover_Letter_References";
    }

    // Modern professional naming format: [Candidate_Name]_[DocType]_[Company].pdf
    return `${cleanName}_${docLabel}_${cleanCompany}.pdf`;
  };

  // Helper to save files using File System Access API or fallback anchor tag
  const downloadBlob = async (blob: Blob, defaultFilename: string, particleCount = 150) => {
    let saved = false;
    
    // Attempt to use showSaveFilePicker to let user choose target directory and filename
    if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [
            {
              description: "PDF Document",
              accept: {
                "application/pdf": [".pdf"]
              }
            }
          ]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        saved = true;

        confetti({
          particleCount,
          spread: particleCount === 200 ? 100 : 80,
          origin: { y: 0.5 }
        });
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("User cancelled save dialog");
          return; // Stop execution on explicit user cancel
        }
        console.warn("showSaveFilePicker failed, falling back to standard download:", err);
      }
    }

    if (!saved) {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      confetti({
        particleCount,
        spread: particleCount === 200 ? 100 : 80,
        origin: { y: 0.5 }
      });
    }
  };

  // Export a single document PDF (CV, Letter, or Prep)
  const handleExportPdf = async (docType?: "cv" | "letter" | "prep") => {
    if (!app) return;
    setExporting(true);
    setShowExportMenu(false);

    await handleSave(true);

    const targetType = docType || activePreviewTab;
    const styledHtml = buildStyledHtml(targetType as "cv" | "letter" | "prep");

    if (!styledHtml) {
      alert("Failed to locate preview node.");
      setExporting(false);
      return;
    }

    const defaultFilename = getProfessionalFilename(targetType);

    try {
      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: styledHtml,
          documentType: targetType,
          company: app.company,
          roleTitle: app.roleTitle,
          fileName: defaultFilename
        })
      });

      if (!res.ok) throw new Error("Server failed to compile PDF");

      const blob = await res.blob();
      const finalFilename = res.headers.get("X-Filename") || defaultFilename;
      await downloadBlob(blob, finalFilename, 150);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to compile PDF. Make sure server is running.");
    } finally {
      setExporting(false);
    }
  };

  // Export merged PDF bundle
  const handleMergeExport = async (mode: "cv-refs" | "full-bundle" | "references" | "letter-refs") => {
    if (!app) return;
    setExporting(true);
    setShowExportMenu(false);

    await handleSave(true);

    // Build parts array
    const parts: Array<{ type: "html" | "file"; content: string }> = [];

    if (mode === "references") {
      parts.push({ type: "file", content: "public/documents/references.pdf" });
    } else if (mode === "letter-refs") {
      const letterHtml = buildStyledHtml("letter");
      if (!letterHtml) {
        alert("Failed to locate Cover Letter preview node. Make sure you have a cover letter configured.");
        setExporting(false);
        return;
      }
      parts.push({ type: "html", content: letterHtml });
      parts.push({ type: "file", content: "public/documents/references.pdf" });
    } else {
      // Standard DACH / European Bewerbungsmappe order for full-bundle:
      // 1. Cover Letter -> 2. CV -> 3. References
      if (mode === "full-bundle") {
        const letterHtml = buildStyledHtml("letter");
        if (!letterHtml) {
          alert("Failed to locate Cover Letter preview node. Make sure you have a cover letter configured.");
          setExporting(false);
          return;
        }
        parts.push({ type: "html", content: letterHtml });
      }

      // Always include CV
      const cvHtml = buildStyledHtml("cv");
      if (!cvHtml) {
        alert("Failed to locate CV preview node.");
        setExporting(false);
        return;
      }
      parts.push({ type: "html", content: cvHtml });

      // Always append references PDF
      parts.push({ type: "file", content: "public/documents/references.pdf" });
    }

    const defaultFilename = getProfessionalFilename(mode);

    try {
      const res = await fetch("/api/merge-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parts,
          company: app.company,
          roleTitle: app.roleTitle,
          fileName: defaultFilename
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).error || "Server failed to merge PDFs");
      }

      const blob = await res.blob();
      const finalFilename = res.headers.get("X-Filename") || defaultFilename;
      await downloadBlob(blob, finalFilename, 200);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to merge PDFs. Make sure server is running.");
    } finally {
      setExporting(false);
    }
  };

  // Helper updates
  const updateCvHeader = (field: string, val: string) => {
    if (!app) return;
    setApp({
      ...app,
      cvContent: {
        ...app.cvContent,
        header: {
          ...app.cvContent.header,
          [field]: val
        }
      }
    });
  };

  const updateCvProfile = (val: string) => {
    if (!app) return;
    setApp({
      ...app,
      cvContent: {
        ...app.cvContent,
        professionalProfile: val
      }
    });
  };

  const updateExperienceBullet = (expIdx: number, bIdx: number, val: string) => {
    if (!app) return;
    const experience = [...app.cvContent.experience];
    experience[expIdx].bullets[bIdx] = val;
    setApp({
      ...app,
      cvContent: {
        ...app.cvContent,
        experience
      }
    });
  };

  const handleAddExperienceBullet = (expIdx: number) => {
    if (!app) return;
    const experience = [...app.cvContent.experience];
    experience[expIdx].bullets.push("New Bullet Point...");
    setApp({
      ...app,
      cvContent: {
        ...app.cvContent,
        experience
      }
    });
  };

  const handleRemoveExperienceBullet = (expIdx: number, bIdx: number) => {
    if (!app) return;
    const experience = [...app.cvContent.experience];
    experience[expIdx].bullets = experience[expIdx].bullets.filter((_, i) => i !== bIdx);
    setApp({
      ...app,
      cvContent: {
        ...app.cvContent,
        experience
      }
    });
  };

  const updateCoverLetterParagraph = (idx: number, val: string) => {
    if (!app) return;
    const paragraphs = [...app.coverLetterContent.paragraphs];
    paragraphs[idx].text = val;
    setApp({
      ...app,
      coverLetterContent: {
        ...app.coverLetterContent,
        paragraphs
      }
    });
  };

  const updateTemplateSettings = (field: string, val: any) => {
    if (!app) return;
    setApp({
      ...app,
      templateSettings: {
        ...app.templateSettings,
        [field]: val
      }
    });
  };

  const updateAssetSettings = (type: "signature" | "photo", field: string, val: any) => {
    if (!app) return;
    setApp({
      ...app,
      assetSettings: {
        ...app.assetSettings,
        [type]: {
          ...app.assetSettings[type],
          [field]: val
        }
      }
    });
  };

  const updateRoleClassification = (field: string, val: any) => {
    if (!app) return;
    setApp({
      ...app,
      roleClassification: {
        ...app.roleClassification,
        [field]: val
      }
    });
  };

  const updateFormFieldAnswers = (field: string, val: any) => {
    if (!app) return;
    setApp({
      ...app,
      formFieldAnswers: {
        ...app.formFieldAnswers,
        [field]: val
      }
    });
  };

  const updateSalaryPositioning = (field: string, val: any) => {
    if (!app) return;
    setApp({
      ...app,
      salaryPositioning: {
        ...app.salaryPositioning,
        [field]: val
      }
    });
  };

  const updateKeywordStrategy = (field: string, val: any) => {
    if (!app) return;
    setApp({
      ...app,
      keywordStrategy: {
        ...app.keywordStrategy,
        [field]: val
      }
    });
  };

  const updateFitAssessment = (field: string, val: any) => {
    if (!app) return;
    setApp({
      ...app,
      fitAssessment: {
        ...app.fitAssessment,
        [field]: val
      }
    });
  };

  const updateQualityControl = (field: string, val: any) => {
    if (!app) return;
    setApp({
      ...app,
      qualityControl: {
        ...app.qualityControl,
        [field]: val
      }
    });
  };

  const updateRecruiterConcern = (idx: number, field: string, val: string) => {
    if (!app) return;
    const likelyConcerns = [...(app.recruiterConcernHandling?.likelyConcerns || [])];
    likelyConcerns[idx] = {
      ...likelyConcerns[idx],
      [field]: val
    };
    setApp({
      ...app,
      recruiterConcernHandling: {
        ...app.recruiterConcernHandling,
        likelyConcerns
      }
    });
  };

  const handleAddRecruiterConcern = () => {
    if (!app) return;
    const likelyConcerns = [...(app.recruiterConcernHandling?.likelyConcerns || []), { concern: "", howToNeutralize: "", sentenceToUse: "" }];
    setApp({
      ...app,
      recruiterConcernHandling: {
        ...app.recruiterConcernHandling,
        likelyConcerns
      }
    });
  };

  const handleRemoveRecruiterConcern = (idx: number) => {
    if (!app) return;
    const likelyConcerns = (app.recruiterConcernHandling?.likelyConcerns || []).filter((_, i) => i !== idx);
    setApp({
      ...app,
      recruiterConcernHandling: {
        ...app.recruiterConcernHandling,
        likelyConcerns
      }
    });
  };

  const handleExportJson = (target: "full" | "strategic" | "cv" | "letter") => {
    if (!app) return;
    setShowExportJsonMenu(false);
    
    let exportData: any = {};
    let fileNameLabel = "Full_Data";
    
    if (target === "full") {
      exportData = app;
      fileNameLabel = "Full_Data";
    } else if (target === "strategic") {
      exportData = {
        roleClassification: app.roleClassification,
        fitAssessment: app.fitAssessment,
        salaryPositioning: app.salaryPositioning,
        keywordStrategy: app.keywordStrategy,
        recruiterConcernHandling: app.recruiterConcernHandling,
        qualityControl: app.qualityControl,
        importMetadata: app.importMetadata
      };
      fileNameLabel = "Strategic_Plan";
    } else if (target === "cv") {
      exportData = app.cvContent;
      fileNameLabel = "CV_Data";
    } else if (target === "letter") {
      exportData = app.coverLetterContent;
      fileNameLabel = "Cover_Letter_Data";
    }
    
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    
    const fullName = app.cvContent?.header?.fullName || "Candidate";
    const cleanName = fullName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");
      
    const cleanCompany = (app.company || "Generic")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");
      
    const defaultFilename = `${cleanName}_${fileNameLabel}_${cleanCompany}.json`;
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    
    alert(`JSON (${target}) exported successfully!`);
  };

  const generateGeminiPrompt = () => {
    if (!app) return "";
    return buildExpertCommitteePrompt({
      targetLanguage: app.language || "auto",
      strategyAngle: "auto",
      companyHint: app.company,
      roleTitleHint: app.roleTitle,
      jobDescription: app.jobDescription || undefined,
    });
  };

  const runAtsScan = () => {
    if (!app || !app.jobDescription) {
      return { score: 0, matched: [], missing: [] };
    }
    
    const desc = app.jobDescription.toLowerCase();
    
    // Combine hardcoded default keywords with strategy keywords from the AI JSON
    const strategyKeywords = [
      ...(app.keywordStrategy?.mustIncludeATSKeywords || []),
      ...(app.keywordStrategy?.niceToHaveKeywords || [])
    ];
    
    const baseKeywords = [
      "BPMN", "Lean Six Sigma", "Six Sigma", "n8n", "Make", "Python", "SQL", "PostgreSQL",
      "Docker", "API", "KPI", "Reporting", "Process optimization", "Business Steering",
      "SOP", "Repository", "Automation", "Operational Excellence", "Quality Reporting",
      "Data Quality", "Compliance", "Auditing", "Stakeholder Management", "n8n integrations",
      "REST APIs", "GDPR", "Process architecture", "Workflow"
    ];
    
    // Deduplicate case-insensitively but preserve original casing for rendering
    const allKeywordsMap = new Map<string, string>();
    [...baseKeywords, ...strategyKeywords].forEach(kw => {
      if (kw && kw.trim()) {
        allKeywordsMap.set(kw.toLowerCase().trim(), kw.trim());
      }
    });
    const searchKeywords = Array.from(allKeywordsMap.values());
    
    const cvText = [
      app.cvContent.professionalProfile,
      ...app.cvContent.keyAchievements,
      ...app.cvContent.coreSkills.flatMap(g => [g.group, ...g.skills]),
      ...app.cvContent.experience.flatMap(e => [e.jobTitle, e.company, e.summary || "", ...e.bullets])
    ].join(" ").toLowerCase();

    const matched: string[] = [];
    const missing: string[] = [];

    searchKeywords.forEach(kw => {
      const kwLower = kw.toLowerCase();
      if (desc.includes(kwLower)) {
        if (cvText.includes(kwLower)) {
          matched.push(kw);
        } else {
          missing.push(kw);
        }
      }
    });

    const totalTarget = matched.length + missing.length;
    const score = totalTarget > 0 ? Math.round((matched.length / totalTarget) * 100) : 0;

    return { score, matched, missing };
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#0a0f1d] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6d8ead]"></div>
        <p className="mt-4 text-[#6d8ead]">Loading compiler environment...</p>
      </div>
    );
  }

  if (!app) return <div className="text-white text-center mt-12">Application not found.</div>;

  return (
    <div className="flex-1 flex flex-col bg-[#0a0f1d] text-[#ededed] h-screen overflow-hidden">
      
      {/* Editor Header */}
      <header className="border-b border-[#1f2937]/60 bg-[#0c1328]/90 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg bg-[#10233f] border border-[#6d8ead]/25 hover:bg-[#152e52] text-[#6d8ead] hover:text-white transition-colors duration-200">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">
              {app.roleTitle}
            </h1>
            <p className="text-xs text-[#6d8ead] font-medium">
              Draft Editor — {app.company}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Prompt Builder Button */}
          <button
            onClick={() => setShowPromptModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10233f] border border-amber-500/30 text-amber-300 font-semibold text-xs transition-all hover:bg-[#183661] active:scale-95 mr-2"
          >
            <Sparkles className="w-3.5 h-3.5" /> Prompt Builder
          </button>

          {/* Import JSON Button */}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10233f] border border-emerald-500/30 text-emerald-300 font-semibold text-xs transition-all hover:bg-[#183661] active:scale-95 mr-2"
          >
            <Package className="w-3.5 h-3.5" /> Import JSON
          </button>

          {/* Preview Tab Toggles */}
          <div className="flex bg-[#0a0f1d] border border-[#1f2937]/80 rounded-xl p-0.5 mr-2">
            <button
              onClick={() => setActivePreviewTab("cv")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                activePreviewTab === "cv" ? "bg-[#10233f] text-[#6d8ead] border border-[#6d8ead]/20" : "text-slate-400 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> CV
            </button>
            <button
              onClick={() => setActivePreviewTab("letter")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                activePreviewTab === "letter" ? "bg-[#10233f] text-[#6d8ead] border border-[#6d8ead]/20" : "text-slate-400 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Cover Letter
            </button>
            <button
              onClick={() => setActivePreviewTab("prep")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                activePreviewTab === "prep" ? "bg-[#10233f] text-[#6d8ead] border border-[#6d8ead]/20" : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Prep STAR
            </button>
          </div>

          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#10233f] hover:bg-[#17335c] border border-[#6d8ead]/30 text-white font-semibold text-xs transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white"></div>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Save Draft
              </>
            )}
          </button>

          {/* Export Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#10233f] to-[#1d3d6b] hover:from-[#152d50] hover:to-[#244e88] border border-[#6d8ead]/30 text-white font-bold text-xs transition-all shadow-md shadow-[#10233f]/30 active:scale-95 disabled:opacity-50"
            >
              {exporting ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white"></div>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" /> Export PDF
                  <ChevronDown className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#0c1328] border border-[#1f2937] rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                {/* Individual Downloads */}
                <div className="px-3 pt-3 pb-1">
                  <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Individual Documents</p>
                </div>
                <button
                  onClick={() => handleExportPdf("cv")}
                  className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-xs text-white hover:bg-[#10233f] transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-[#6d8ead]" />
                  <div>
                    <span className="font-semibold">Download CV</span>
                    <span className="block text-[9px] text-slate-500">Curriculum Vitae only</span>
                  </div>
                </button>
                <button
                  onClick={() => handleExportPdf("letter")}
                  className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-xs text-white hover:bg-[#10233f] transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-[#6d8ead]" />
                  <div>
                    <span className="font-semibold">Download Cover Letter</span>
                    <span className="block text-[9px] text-slate-500">Cover Letter only</span>
                  </div>
                </button>
                <button
                  onClick={() => handleMergeExport("references")}
                  className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-xs text-white hover:bg-[#10233f] transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-[#6d8ead]" />
                  <div>
                    <span className="font-semibold">Download References</span>
                    <span className="block text-[9px] text-slate-500">Recommendation letters only</span>
                  </div>
                </button>
                <button
                  onClick={() => handleExportPdf("prep")}
                  className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-xs text-white hover:bg-[#10233f] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <div>
                    <span className="font-semibold">Download STAR Prep</span>
                    <span className="block text-[9px] text-slate-500">Interview preparation guide</span>
                  </div>
                </button>

                {/* Merged Bundles */}
                <div className="border-t border-[#1f2937] px-3 pt-3 pb-1 mt-1">
                  <p className="text-[9px] uppercase font-bold text-amber-500/70 tracking-wider">📦 Merged Bundles</p>
                </div>
                <button
                  onClick={() => handleMergeExport("cv-refs")}
                  className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-xs text-white hover:bg-[#10233f] transition-colors"
                >
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <div>
                    <span className="font-semibold">CV + References</span>
                    <span className="block text-[9px] text-slate-500">CV merged with certificates & references</span>
                  </div>
                </button>
                <button
                  onClick={() => handleMergeExport("letter-refs")}
                  className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-xs text-white hover:bg-[#10233f] transition-colors"
                >
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <div>
                    <span className="font-semibold">Cover Letter + References</span>
                    <span className="block text-[9px] text-slate-500">Cover Letter merged with certificates & references</span>
                  </div>
                </button>
                <button
                  onClick={() => handleMergeExport("full-bundle")}
                  className="w-full px-3 py-2.5 pb-3 text-left flex items-center gap-2.5 text-xs text-white hover:bg-[#10233f] transition-colors rounded-b-xl"
                >
                  <Package className="w-3.5 h-3.5 text-emerald-400" />
                  <div>
                    <span className="font-semibold text-emerald-300">Full Application Bundle</span>
                    <span className="block text-[9px] text-slate-500">CV + Cover Letter + References</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Export JSON Dropdown */}
          <div className="relative" ref={exportJsonMenuRef}>
            <button
              onClick={() => setShowExportJsonMenu(!showExportJsonMenu)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0c1328] hover:bg-[#10233f] border border-[#6d8ead]/30 text-white font-bold text-xs transition-all active:scale-95"
            >
              <Package className="w-3.5 h-3.5 text-emerald-400" /> Export JSON
              <ChevronDown className={`w-3 h-3 transition-transform ${showExportJsonMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportJsonMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#0c1328] border border-[#1f2937] rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-3 pt-3 pb-1">
                  <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Export Formats</p>
                </div>
                <button
                  onClick={() => handleExportJson("full")}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 text-xs text-white hover:bg-[#10233f] transition-colors"
                >
                  <Package className="w-3.5 h-3.5 text-emerald-400" />
                  <div>
                    <span className="font-semibold">Full Application JSON</span>
                    <span className="block text-[9px] text-slate-500">All data including strategy</span>
                  </div>
                </button>
                <button
                  onClick={() => handleExportJson("strategic")}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 text-xs text-white hover:bg-[#10233f] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <div>
                    <span className="font-semibold">Strategy Plan Only</span>
                    <span className="block text-[9px] text-slate-500">Only LLM strategic sections</span>
                  </div>
                </button>
                <button
                  onClick={() => handleExportJson("cv")}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 text-xs text-white hover:bg-[#10233f] transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-[#6d8ead]" />
                  <div>
                    <span className="font-semibold">CV Content Only</span>
                    <span className="block text-[9px] text-slate-500">Only curriculum vitae data</span>
                  </div>
                </button>
                <button
                  onClick={() => handleExportJson("letter")}
                  className="w-full px-3 py-2.5 text-left flex items-center gap-2 text-xs text-white hover:bg-[#10233f] transition-colors rounded-b-xl"
                >
                  <FileText className="w-3.5 h-3.5 text-[#6d8ead]" />
                  <div>
                    <span className="font-semibold">Cover Letter Only</span>
                    <span className="block text-[9px] text-slate-500">Only cover letter paragraphs</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Editor Split-Screen Pane */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Form Editor Panel */}
        <div className="w-[45%] border-r border-[#1f2937]/60 bg-[#070c18] flex flex-col overflow-hidden">
          
          {/* Inner Accordion Tabs */}
          <div className="flex bg-[#0c1328]/80 border-b border-[#1f2937]/50 p-2 overflow-x-auto shrink-0 gap-1">
            {[
              { id: "cv-profile", label: "Bio / Header" },
              { id: "cv-exp", label: "Experience History" },
              { id: "cv-projects", label: "Projects" },
              { id: "cv-skills", label: "Skills pool" },
              { id: "cover-letter", label: "Cover Letter Body" },
              { id: "strategy", label: "🎯 Strategy Target" },
              { id: "form-answers", label: "📝 Form Answers" },
              { id: "tracking", label: "💼 Job Tracker" },
              { id: "ats-scanner", label: "🔍 ATS Scanner" },
              { id: "assets", label: "Layout & Assets" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveInputTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                  activeInputTab === tab.id
                    ? "bg-[#10233f]/50 text-white border border-[#6d8ead]/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Form scrollable container */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            
            {/* 1. Profile / Header Tab */}
            {activeInputTab === "cv-profile" && (
              <div className="space-y-5">
                {/* Application Target (Company & Position) */}
                <div className="rounded-xl border border-amber-500/25 bg-[#10233f]/40 p-4 space-y-3">
                  <h3 className="text-sm font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5" /> Application Target
                  </h3>
                  <p className="text-[10px] text-slate-400 -mt-1 mb-2">Edit the company name and position title for this application.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-amber-400/80 block mb-1">Company Name</label>
                      <input
                        type="text"
                        value={app.company}
                        onChange={(e) => setApp({ ...app, company: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-amber-500/30 text-white text-xs focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors"
                        placeholder="e.g. SAP SE"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-amber-400/80 block mb-1">Position / Role Title</label>
                      <input
                        type="text"
                        value={app.roleTitle}
                        onChange={(e) => setApp({ ...app, roleTitle: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-amber-500/30 text-white text-xs focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors"
                        placeholder="e.g. Process Automation Engineer"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white mb-2">Edit Headline / Profile</h3>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-[#6d8ead] block">Headline Title</label>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold tracking-wider scale-90">PDF-SAFE</span>
                  </div>
                  <input
                    type="text"
                    value={app.cvContent.header.headline}
                    onChange={(e) => updateCvHeader("headline", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-[#6d8ead] block">Professional Profile Summary</label>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold tracking-wider scale-90">PDF-SAFE</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mb-1.5">
                    Tip: Overwrite this box with the tailored paragraph generated by Gemini Web.
                  </p>
                  <textarea
                    rows={8}
                    value={app.cvContent.professionalProfile}
                    onChange={(e) => updateCvProfile(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                  />
                </div>

                <div className="border-t border-[#1f2937] pt-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Email</label>
                    <input
                      type="email"
                      value={app.cvContent.header.email}
                      onChange={(e) => updateCvHeader("email", e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Phone</label>
                    <input
                      type="text"
                      value={app.cvContent.header.phone}
                      onChange={(e) => updateCvHeader("phone", e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1f2937]/50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#10233f] hover:bg-[#17335c] border border-[#6d8ead]/30 text-white font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 text-[#6d8ead]" /> Save Bio & Header
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 2. Experience History Tab */}
            {activeInputTab === "cv-exp" && (
              <div className="space-y-6">
                <div className="border-b border-[#1f2937] pb-2">
                  <h3 className="text-sm font-bold text-white">Experience Bullet Compiler</h3>
                  <p className="text-[10px] text-slate-500">
                    Replace or edit bullets as suggested by your external Gemini chatbot.
                  </p>
                </div>

                {app.cvContent.experience.map((exp, expIdx) => (
                  <div key={exp.id || expIdx} className="bg-[#0e162d]/50 p-4 rounded-xl border border-[#1f2937]/50 space-y-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-[#6d8ead]">{exp.jobTitle}</span>
                      <span className="text-[9px] text-slate-400">{exp.company}</span>
                    </div>

                    <div className="space-y-2">
                      {exp.bullets.map((bullet, bIdx) => (
                        <div key={bIdx} className="flex gap-2 items-start bg-[#0a0f1d]/60 p-2 rounded border border-[#1f2937]/40">
                          <textarea
                            rows={2}
                            value={bullet}
                            onChange={(e) => updateExperienceBullet(expIdx, bIdx, e.target.value)}
                            className="flex-1 bg-transparent text-white text-[11px] outline-none leading-relaxed resize-y"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveExperienceBullet(expIdx, bIdx)}
                            className="text-rose-400 hover:text-rose-300 p-0.5"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddExperienceBullet(expIdx)}
                      className="text-[10px] text-[#6d8ead] hover:underline"
                    >
                      + Add Bullet
                    </button>
                  </div>
                ))}

                <div className="pt-4 border-t border-[#1f2937]/50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#10233f] hover:bg-[#17335c] border border-[#6d8ead]/30 text-white font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 text-[#6d8ead]" /> Save Experience History
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 2.5. Projects Tab */}
            {activeInputTab === "cv-projects" && (
              <div className="space-y-6">
                <div className="border-b border-[#1f2937] pb-2">
                  <h3 className="text-sm font-bold text-white">Projects & Lab Practice</h3>
                  <p className="text-[10px] text-slate-500">
                    Edit independent projects, labs, and workflow engineering practices (e.g. CloudFlow Analytics, DataMesh Lab).
                  </p>
                </div>

                {(app.cvContent.projects || []).map((proj, projIdx) => (
                  <div key={proj.id || projIdx} className="bg-[#0e162d]/50 p-4 rounded-xl border border-[#1f2937]/50 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Project Name</label>
                        <input
                          type="text"
                          value={proj.title}
                          onChange={(e) => {
                            const projects = [...(app.cvContent.projects || [])];
                            projects[projIdx].title = e.target.value;
                            setApp({ ...app, cvContent: { ...app.cvContent, projects } });
                          }}
                          className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Role / Subtitle</label>
                        <input
                          type="text"
                          value={proj.role}
                          onChange={(e) => {
                            const projects = [...(app.cvContent.projects || [])];
                            projects[projIdx].role = e.target.value;
                            setApp({ ...app, cvContent: { ...app.cvContent, projects } });
                          }}
                          className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Dates / Period</label>
                        <input
                          type="text"
                          value={proj.dates}
                          onChange={(e) => {
                            const projects = [...(app.cvContent.projects || [])];
                            projects[projIdx].dates = e.target.value;
                            setApp({ ...app, cvContent: { ...app.cvContent, projects } });
                          }}
                          className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Short Description</label>
                        <input
                          type="text"
                          value={proj.description}
                          onChange={(e) => {
                            const projects = [...(app.cvContent.projects || [])];
                            projects[projIdx].description = e.target.value;
                            setApp({ ...app, cvContent: { ...app.cvContent, projects } });
                          }}
                          className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block">Project Bullets / Details</label>
                      {(proj.bullets || []).map((bullet, bIdx) => (
                        <div key={bIdx} className="flex gap-2 items-start bg-[#0a0f1d]/60 p-2 rounded border border-[#1f2937]/40">
                          <textarea
                            rows={2}
                            value={bullet}
                            onChange={(e) => {
                              const projects = [...(app.cvContent.projects || [])];
                              projects[projIdx].bullets[bIdx] = e.target.value;
                              setApp({ ...app, cvContent: { ...app.cvContent, projects } });
                            }}
                            className="flex-1 bg-transparent text-white text-[11px] outline-none leading-relaxed resize-y"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const projects = [...(app.cvContent.projects || [])];
                              projects[projIdx].bullets = projects[projIdx].bullets.filter((_, i) => i !== bIdx);
                              setApp({ ...app, cvContent: { ...app.cvContent, projects } });
                            }}
                            className="text-rose-400 hover:text-rose-300 p-0.5 font-bold"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const projects = [...(app.cvContent.projects || [])];
                          projects[projIdx].bullets = [...(projects[projIdx].bullets || []), "New detail bullet..."];
                          setApp({ ...app, cvContent: { ...app.cvContent, projects } });
                        }}
                        className="text-[10px] text-[#6d8ead] hover:underline"
                      >
                        + Add Detail Bullet
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const projects = (app.cvContent.projects || []).filter((_, i) => i !== projIdx);
                          setApp({ ...app, cvContent: { ...app.cvContent, projects } });
                        }}
                        className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove Project
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const newProj = {
                        id: `proj-${Date.now()}`,
                        title: "New Project",
                        role: "Developer",
                        dates: "Period",
                        description: "Short summary",
                        bullets: ["First bullet detail..."]
                      };
                      const projects = [...(app.cvContent.projects || []), newProj];
                      setApp({ ...app, cvContent: { ...app.cvContent, projects } });
                    }}
                    className="flex items-center gap-1.5 text-xs text-[#6d8ead] hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Project
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#10233f] hover:bg-[#17335c] border border-[#6d8ead]/30 text-white font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 text-[#6d8ead]" /> Save Projects
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 3. Core Skills Tab */}
            {activeInputTab === "cv-skills" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-white mb-2">Edit Key Achievements</h3>
                  <p className="text-[10px] text-[#6b7280] mb-3">
                    Select achievements that align with your targets. You can edit their text directly.
                  </p>
                  
                  <div className="space-y-2.5">
                    {app.cvContent.keyAchievements.map((ach, idx) => (
                      <div key={idx} className="flex gap-2 items-start bg-[#0a0f1d] p-2.5 rounded border border-[#1f2937]">
                        <textarea
                          rows={2}
                          value={ach}
                          onChange={(e) => {
                            const keyAchievements = [...app.cvContent.keyAchievements];
                            keyAchievements[idx] = e.target.value;
                            setApp({ ...app, cvContent: { ...app.cvContent, keyAchievements } });
                          }}
                          className="flex-1 bg-transparent text-white text-xs outline-none leading-relaxed"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const keyAchievements = app.cvContent.keyAchievements.filter((_, i) => i !== idx);
                            setApp({ ...app, cvContent: { ...app.cvContent, keyAchievements } });
                          }}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const keyAchievements = [...app.cvContent.keyAchievements, "New achievement text..."];
                        setApp({ ...app, cvContent: { ...app.cvContent, keyAchievements } });
                      }}
                      className="text-xs text-[#6d8ead] hover:underline"
                    >
                      + Add Key Achievement
                    </button>
                  </div>
                </div>

                <div className="border-t border-[#1f2937] pt-4">
                  <h3 className="text-sm font-bold text-white mb-2">Skill Group Configuration</h3>
                  <div className="space-y-3">
                    {app.cvContent.coreSkills.map((group, idx) => (
                      <div key={idx} className="bg-[#0a0f1d] p-3 rounded border border-[#1f2937] space-y-2">
                        <div className="flex justify-between items-center">
                          <input
                            type="text"
                            value={group.group}
                            onChange={(e) => {
                              const coreSkills = [...app.cvContent.coreSkills];
                              coreSkills[idx].group = e.target.value;
                              setApp({ ...app, cvContent: { ...app.cvContent, coreSkills } });
                            }}
                            className="bg-transparent text-[10px] font-bold uppercase tracking-wider text-[#6d8ead] outline-none border-b border-transparent focus:border-[#6d8ead] w-2/3"
                            placeholder="Group Title (e.g. TECHNICAL TOOLS)"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const coreSkills = app.cvContent.coreSkills.filter((_, i) => i !== idx);
                              setApp({ ...app, cvContent: { ...app.cvContent, coreSkills } });
                            }}
                            className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-1.5 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> Remove Group
                          </button>
                        </div>
                        <div>
                          <input
                            type="text"
                            value={group.skills.join(", ")}
                            onChange={(e) => {
                              const coreSkills = [...app.cvContent.coreSkills];
                              coreSkills[idx].skills = e.target.value.split(",").map(s => s.trim());
                              setApp({ ...app, cvContent: { ...app.cvContent, coreSkills } });
                            }}
                            className="w-full bg-[#0a0f1d] border-b border-[#1f2937] text-white text-xs py-1 outline-none focus:border-[#6d8ead]"
                            placeholder="Skills (comma-separated, e.g. Python, SQL)"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const coreSkills = [...app.cvContent.coreSkills, { group: "New Group", skills: [] }];
                        setApp({ ...app, cvContent: { ...app.cvContent, coreSkills } });
                      }}
                      className="flex items-center gap-1.5 text-xs text-[#6d8ead] hover:underline pt-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Skill Group
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1f2937]/50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#10233f] hover:bg-[#17335c] border border-[#6d8ead]/30 text-white font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 text-[#6d8ead]" /> Save Skills & Achievements
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 4. Cover Letter Paragraphs Tab */}
            {activeInputTab === "cover-letter" && (
              <div className="space-y-5">
                <div className="border-b border-[#1f2937] pb-2 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-white">Cover Letter Paragraphs</h3>
                    <p className="text-[10px] text-slate-500">
                      Paste the company-specific paragraphs generated by Gemini Web.
                    </p>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold tracking-wider">PDF-SAFE</span>
                </div>

                <div className="flex justify-between items-center bg-[#0e162d]/50 p-3 rounded-xl border border-[#1f2937]/50">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-white">Quick Copy Options</span>
                    <span className="text-[9px] text-slate-400">Copy cover letter for manual applications</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!app) return;
                      const date = app.coverLetterContent.dateLine || "";
                      const targetRole = app.coverLetterContent.roleTitle || app.roleTitle || "";
                      const subject =
                        app.coverLetterContent.subjectLine ||
                        (app.language === "German"
                          ? `Bewerbung als ${targetRole}`
                          : app.language === "Spanish"
                          ? `Candidatura al puesto de ${targetRole}`
                          : `Application for ${targetRole}`);
                      const greeting = app.coverLetterContent.greeting || "";
                      const paragraphsStr = app.coverLetterContent.paragraphs.map(p => p.text).join("\n\n");
                      const closing = app.coverLetterContent.closingPhrase || "";
                      const signature = app.coverLetterContent.signatureName || "";
                      const fullLetter = `${date}\n\n${subject}\n\n${greeting}\n\n${paragraphsStr}\n\n${closing}\n\n${signature}`;
                      navigator.clipboard.writeText(fullLetter);
                      alert("Cover Letter copied to clipboard as plain text!");
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#10233f] hover:bg-[#183661] border border-[#6d8ead]/30 text-white font-semibold text-xs transition-all active:scale-95"
                  >
                    📋 Copy Full Cover Letter as Plain Text
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Date line</label>
                    <input
                      type="text"
                      value={app.coverLetterContent.dateLine}
                      onChange={(e) => setApp({
                        ...app,
                        coverLetterContent: { ...app.coverLetterContent, dateLine: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Greeting</label>
                    <input
                      type="text"
                      value={app.coverLetterContent.greeting}
                      onChange={(e) => setApp({
                        ...app,
                        coverLetterContent: { ...app.coverLetterContent, greeting: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Subject Line / Betreffzeile (DIN 5008)</label>
                    <input
                      type="text"
                      value={app.coverLetterContent.subjectLine || ""}
                      onChange={(e) => setApp({
                        ...app,
                        coverLetterContent: { ...app.coverLetterContent, subjectLine: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                      placeholder={`Auto: Application for ${app.roleTitle || "Role"}`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Cover Letter Subtitle / Positioning Line</label>
                    <input
                      type="text"
                      value={app.coverLetterContent.positioningLine || ""}
                      onChange={(e) => setApp({
                        ...app,
                        coverLetterContent: { ...app.coverLetterContent, positioningLine: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                      placeholder="e.g. Business Process Analyst · Workflow Automation · BPMN"
                    />
                  </div>
                </div>

                {/* Sidebar customization details */}
                <div className="rounded-xl border border-[#1f2937]/50 bg-[#0e162d]/30 p-4 space-y-3">
                  <h4 className="text-xs font-bold text-white mb-0.5">Executive Sidebar Template Customization</h4>
                  <p className="text-[9px] text-slate-500 -mt-1.5">Customize the labels shown on the blue vertical sidebar in the Asr Sidebar template.</p>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Sidebar Label</label>
                      <input
                        type="text"
                        value={app.coverLetterContent.sidebarLabel || "COVER LETTER"}
                        onChange={(e) => setApp({
                          ...app,
                          coverLetterContent: { ...app.coverLetterContent, sidebarLabel: e.target.value }
                        })}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        placeholder="e.g. COVER LETTER"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Sidebar Role</label>
                      <input
                        type="text"
                        value={app.coverLetterContent.sidebarRole || ""}
                        onChange={(e) => setApp({
                          ...app,
                          coverLetterContent: { ...app.coverLetterContent, sidebarRole: e.target.value }
                        })}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        placeholder="Defaults to Role Title"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Sidebar Company</label>
                      <input
                        type="text"
                        value={app.coverLetterContent.sidebarCompany || ""}
                        onChange={(e) => setApp({
                          ...app,
                          coverLetterContent: { ...app.coverLetterContent, sidebarCompany: e.target.value }
                        })}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        placeholder="Defaults to Company"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  {app.coverLetterContent.paragraphs.map((p, idx) => (
                    <div key={idx} className="space-y-1 bg-[#0a0f1d] p-3.5 rounded border border-[#1f2937]/50">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#6d8ead]">
                        Paragraph {idx + 1} — {p.type}
                      </span>
                      <textarea
                        rows={5}
                        value={p.text}
                        onChange={(e) => updateCoverLetterParagraph(idx, e.target.value)}
                        className="w-full bg-transparent text-white text-xs leading-relaxed outline-none border-t border-transparent focus:border-t-[#1f2937] pt-1.5"
                      />
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#1f2937] pt-4">
                  <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Closing Phrase</label>
                  <input
                    type="text"
                    value={app.coverLetterContent.closingPhrase}
                    onChange={(e) => setApp({
                      ...app,
                      coverLetterContent: { ...app.coverLetterContent, closingPhrase: e.target.value }
                    })}
                    className="w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                  />
                </div>

                <div className="pt-4 border-t border-[#1f2937]/50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#10233f] hover:bg-[#17335c] border border-[#6d8ead]/30 text-white font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 text-[#6d8ead]" /> Save Cover Letter
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Job Tracker Tab */}
            {activeInputTab === "tracking" && (
              <div className="space-y-5">
                <div className="border-b border-[#1f2937] pb-2">
                  <h3 className="text-sm font-bold text-white">Application Pipeline Tracker</h3>
                  <p className="text-[10px] text-slate-500">
                    Track the status, recruiter contacts, interview dates, and follow-up notes for this hiring process.
                  </p>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Application Status</label>
                  <select
                    value={app.status}
                    onChange={(e) => setApp({ ...app, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer focus:outline-none focus:border-[#6d8ead]"
                  >
                    <option value="draft">Draft</option>
                    <option value="applied">Applied</option>
                    <option value="interviewing">Interviewing</option>
                    <option value="offered">Offer Received</option>
                    <option value="rejected">Rejected</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Interview Date & Time</label>
                    <input
                      type="text"
                      placeholder="e.g. Monday June 15, 14:00 CET"
                      value={app.interviewDate || ""}
                      onChange={(e) => setApp({ ...app, interviewDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#0a0f1d] border border-[#1f2937] text-white text-xs focus:outline-none focus:border-[#6d8ead]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Salary / Offer Range</label>
                    <input
                      type="text"
                      placeholder="e.g. €65,000 / year"
                      value={app.salaryOffer || ""}
                      onChange={(e) => setApp({ ...app, salaryOffer: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#0a0f1d] border border-[#1f2937] text-white text-xs focus:outline-none focus:border-[#6d8ead]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Recruiter / Hiring Manager Contact</label>
                  <input
                    type="text"
                    placeholder="Contact name, email, or LinkedIn URL"
                    value={app.recruiterContact || ""}
                    onChange={(e) => setApp({ ...app, recruiterContact: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#0a0f1d] border border-[#1f2937] text-white text-xs focus:outline-none focus:border-[#6d8ead]"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Follow-up Notes & Call Logs</label>
                  <textarea
                    rows={8}
                    placeholder="Write notes about recruiter calls, next steps, technical questions to prepare..."
                    value={app.notes || ""}
                    onChange={(e) => setApp({ ...app, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#0a0f1d] border border-[#1f2937] text-white text-xs focus:outline-none focus:border-[#6d8ead] leading-relaxed resize-y"
                  />
                </div>

                {/* Recruiter Email templates */}
                <div className="border-t border-[#1f2937] pt-4 mt-2">
                  <span className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-2">Recruiter Outreach & Follow-Up Email Templates</span>
                  <div className="space-y-2">
                    {[
                      {
                        title: "📬 Post-Application Follow-up (English)",
                        lang: "English",
                        subject: `Application Follow-up - ${app.roleTitle} - ${app.cvContent?.header?.fullName || "Candidate Name"}`,
                        body: `Dear ${app.recruiterContact ? app.recruiterContact.split(" ")[0] : "Hiring Team"},\n\nI hope this email finds you well. I am writing to briefly follow up on my application for the ${app.roleTitle} role at ${app.company}.\n\nHaving reviewed the requirements, I am very excited about the possibility of contributing to your team with my background in process automation and operational steering. Please let me know if you need any additional information from my side or if we could schedule a brief introductory call.\n\nBest regards,\n${app.cvContent?.header?.fullName || "Candidate Name"}`
                      },
                      {
                        title: "📅 Post-Interview Thank You Note (English)",
                        lang: "English",
                        subject: `Thank you — Interview for ${app.roleTitle} - ${app.cvContent?.header?.fullName || "Candidate Name"}`,
                        body: `Dear ${app.recruiterContact ? app.recruiterContact.split(" ")[0] : "Hiring Manager"},\n\nThank you very much for taking the time today to discuss the ${app.roleTitle} position at ${app.company}.\n\nI thoroughly enjoyed learning more about the team's upcoming priorities and operational challenges. Our conversation further reinforced how well my experience building automated workflows and governing business processes aligns with your goals. I look forward to hearing about the next steps in the process.\n\nBest regards,\n${app.cvContent?.header?.fullName || "Candidate Name"}`
                      },
                      {
                        title: "📬 Follow-up nach Bewerbung (German)",
                        lang: "German",
                        subject: `Rückfrage zur Bewerbung als ${app.roleTitle} - ${app.cvContent?.header?.fullName || "Candidate Name"}`,
                        body: `Sehr geehrte(r) ${app.recruiterContact ? app.recruiterContact : "Damen und Herren"},\n\nich hoffe, Sie haben eine erfolgreiche Woche. Hiermit möchte ich mich kurz nach dem aktuellen Stand meiner Bewerbung als ${app.roleTitle} bei ${app.company} erkundigen.\n\nDie Position spricht mich aufgrund meiner Erfahrung in der Prozessautomatisierung sowie der operativen Prozesssteuerung besonders an. Für Rückfragen oder ein erstes Kennenlerngespräch stehe ich Ihnen jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen\n${app.cvContent?.header?.fullName || "Candidate Name"}`
                      }
                    ].map((tpl, i) => (
                      <div key={i} className="bg-[#0a0f1d] border border-[#1f2937]/50 rounded-xl p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-white">{tpl.title}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const fullText = `Subject: ${tpl.subject}\n\n${tpl.body}`;
                              navigator.clipboard.writeText(fullText);
                              alert("Email template copied to clipboard!");
                            }}
                            className="text-[9px] text-[#6d8ead] hover:underline"
                          >
                            Copy
                          </button>
                        </div>
                        <p className="text-[9px] text-slate-400 truncate font-mono">Subject: {tpl.subject}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1f2937]/50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#10233f] hover:bg-[#17335c] border border-[#6d8ead]/30 text-white font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 text-[#6d8ead]" /> Save Tracker Info
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ATS Scanner Tab */}
            {activeInputTab === "ats-scanner" && (() => {
              const { score, matched, missing } = runAtsScan();
              return (
                <div className="space-y-5">
                  <div className="border-b border-[#1f2937] pb-2">
                    <h3 className="text-sm font-bold text-white">ATS Keyword Compatibility Scanner</h3>
                    <p className="text-[10px] text-slate-500">
                      Paste the job description below to analyze whether your CV contains the essential keywords required to pass automated ATS filters.
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Job Description</label>
                    <textarea
                      rows={6}
                      placeholder="Paste the full job description here to run an instant ATS keyword compatibility check..."
                      value={app.jobDescription || ""}
                      onChange={(e) => setApp({ ...app, jobDescription: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#0a0f1d] border border-[#1f2937] text-white text-xs focus:outline-none focus:border-[#6d8ead] leading-relaxed resize-y"
                    />
                  </div>

                  {app.jobDescription ? (
                    <div className="space-y-4">
                      {/* Match Score Gauge */}
                      <div className="bg-[#0e162d]/50 p-4 rounded-xl border border-[#1f2937]/50 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-white block">ATS Keyword Match Score</span>
                          <span className="text-[9px] text-[#6b7280]">Based on target keywords detected in the job description</span>
                        </div>
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-base border-2 ${
                          score >= 70 ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" :
                          score >= 40 ? "border-amber-500 text-amber-400 bg-amber-500/10" :
                          "border-rose-500 text-rose-400 bg-rose-500/10"
                        }`}>
                          {score}%
                        </div>
                      </div>

                      {/* Matched Keywords */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1.5">
                          ✓ Matched Keywords ({matched.length})
                        </span>
                        {matched.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {matched.map((kw, i) => (
                              <span key={i} className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                {kw}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic">No keyword matches detected yet.</p>
                        )}
                      </div>

                      {/* Missing Keywords */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-rose-400 block mb-1.5">
                          ⚠️ Missing Keywords ({missing.length})
                        </span>
                        {missing.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {missing.map((kw, i) => (
                              <span key={i} className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full">
                                {kw}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-emerald-400 italic font-semibold">Great job! All primary target keywords are covered in your current CV.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#0e162d]/20 border border-dashed border-[#1f2937] p-5 rounded-xl text-center text-xs text-[#6b7280]">
                      Paste the full job description in the box above to run an instant ATS keyword scan.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Strategy Target Tab */}
            {activeInputTab === "strategy" && (
              <div className="space-y-6">
                <div className="border-b border-[#1f2937] pb-2 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-white">🎯 LLM Candidature Strategy</h3>
                    <p className="text-[10px] text-slate-500">
                      Manage role fitting, keywords, recruiter concerns, and salary positioning.
                    </p>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold tracking-wider">STRATEGY-ONLY</span>
                </div>

                {/* Fit Assessment Card */}
                <div className="bg-[#0e162d]/50 p-4 rounded-xl border border-[#1f2937]/50 space-y-4">
                  <h4 className="text-xs font-bold text-white flex items-center justify-between border-b border-[#1f2937]/50 pb-2">
                    <span>🔍 Fit Assessment</span>
                    <span className="text-[9px] text-[#6d8ead]">Overall match strategy</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Fit Score (0-10)</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        placeholder="Not set"
                        value={app.fitAssessment?.scoreOutOf10 ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? null : Number(e.target.value);
                          updateFitAssessment("scoreOutOf10", val);
                        }}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Probability Tier</label>
                      <select
                        value={app.fitAssessment?.probabilityTier || "Medium"}
                        onChange={(e) => updateFitAssessment("probabilityTier", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
                      >
                        <option value="Very Low">Very Low</option>
                        <option value="Low">Low</option>
                        <option value="Medium-Low">Medium-Low</option>
                        <option value="Medium">Medium</option>
                        <option value="Medium-High">Medium-High</option>
                        <option value="High">High</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Apply or Skip</label>
                      <select
                        value={app.fitAssessment?.applyOrSkip || "Apply selectively"}
                        onChange={(e) => updateFitAssessment("applyOrSkip", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
                      >
                        <option value="Apply">Apply</option>
                        <option value="Apply selectively">Apply selectively</option>
                        <option value="Skip">Skip</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Recommended CV Version</label>
                      <input
                        type="text"
                        value={app.fitAssessment?.recommendedCVVersion || ""}
                        onChange={(e) => updateFitAssessment("recommendedCVVersion", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        placeholder="e.g. Technical-Dense"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Fit Summary Justification</label>
                    <textarea
                      rows={3}
                      value={app.fitAssessment?.summary || ""}
                      onChange={(e) => updateFitAssessment("summary", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                      placeholder="Why is this candidate a good/medium fit for this role?"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-emerald-400 block mb-1">Best Selling Angles (one per line)</label>
                      <textarea
                        rows={3}
                        value={(app.fitAssessment?.bestAngles || []).join("\n")}
                        onChange={(e) => updateFitAssessment("bestAngles", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                        placeholder="e.g. Deep multi-market operations experience"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-rose-400 block mb-1">Main Risks & Gaps (one per line)</label>
                      <textarea
                        rows={3}
                        value={(app.fitAssessment?.mainRisks || []).join("\n")}
                        onChange={(e) => updateFitAssessment("mainRisks", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                        placeholder="e.g. German language level at B1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Recommended Tone / Application Strategy</label>
                    <textarea
                      rows={2}
                      value={app.fitAssessment?.recommendedApplicationStrategy || ""}
                      onChange={(e) => updateFitAssessment("recommendedApplicationStrategy", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                      placeholder="Focus on operations automation and process architecture steering..."
                    />
                  </div>
                </div>

                {/* Role Classification Card */}
                <div className="bg-[#0e162d]/50 p-4 rounded-xl border border-[#1f2937]/50 space-y-4">
                  <h4 className="text-xs font-bold text-white flex items-center justify-between border-b border-[#1f2937]/50 pb-2">
                    <span>Role Classification</span>
                    <span className="text-[9px] text-[#6d8ead]">LLM categorization</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Role Type</label>
                      <select
                        value={app.roleClassification?.type || "coreTarget"}
                        onChange={(e) => updateRoleClassification("type", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
                      >
                        <option value="coreTarget">Core Target</option>
                        <option value="bridgeRole">Bridge Role</option>
                        <option value="stretchRole">Stretch Role</option>
                        <option value="stabilityRole">Stability Role</option>
                        <option value="alternativeRole">Alternative Role</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Seniority Level</label>
                      <select
                        value={app.roleClassification?.seniorityLevel || "mid"}
                        onChange={(e) => updateRoleClassification("seniorityLevel", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
                      >
                        <option value="entry">Entry</option>
                        <option value="junior">Junior</option>
                        <option value="mid">Mid</option>
                        <option value="mid-senior">Mid-Senior</option>
                        <option value="senior">Senior</option>
                        <option value="lead">Lead</option>
                        <option value="executive">Executive</option>
                        <option value="unclear">Unclear</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Role Family</label>
                      <input
                        type="text"
                        value={app.roleClassification?.roleFamily || ""}
                        onChange={(e) => updateRoleClassification("roleFamily", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        placeholder="e.g. Operations / Analyst"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Priority</label>
                      <select
                        value={app.roleClassification?.applicationPriority || "medium"}
                        onChange={(e) => updateRoleClassification("applicationPriority", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="strategic">Strategic</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Job Location</label>
                      <input
                        type="text"
                        value={app.jobLocation || ""}
                        onChange={(e) => setApp({ ...app, jobLocation: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        placeholder="e.g. Berlin, Germany"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Work Model</label>
                      <input
                        type="text"
                        value={app.workModel || ""}
                        onChange={(e) => setApp({ ...app, workModel: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        placeholder="e.g. Hybrid / Remote"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Recommended Positioning Statement</label>
                    <textarea
                      rows={2}
                      value={app.roleClassification?.recommendedPositioning || ""}
                      onChange={(e) => updateRoleClassification("recommendedPositioning", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                      placeholder="Process architecture expert with deep automation experience..."
                    />
                  </div>
                </div>

                {/* Salary Positioning Card */}
                <div className="bg-[#0e162d]/50 p-4 rounded-xl border border-[#1f2937]/50 space-y-4">
                  <h4 className="text-xs font-bold text-white flex items-center justify-between border-b border-[#1f2937]/50 pb-2">
                    <span>💰 Salary Positioning</span>
                    <span className="text-[9px] text-[#6d8ead]">Compensation strategy</span>
                  </h4>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Recommended Range</label>
                      <input
                        type="text"
                        value={app.salaryPositioning?.recommendedRangeEUR || ""}
                        onChange={(e) => updateSalaryPositioning("recommendedRangeEUR", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        placeholder="e.g. 65k - 75k"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Safe Number</label>
                      <input
                        type="text"
                        value={app.salaryPositioning?.safeNumberEUR || ""}
                        onChange={(e) => updateSalaryPositioning("safeNumberEUR", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        placeholder="e.g. 68,000"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Ambitious Number</label>
                      <input
                        type="text"
                        value={app.salaryPositioning?.ambitiousNumberEUR || ""}
                        onChange={(e) => updateSalaryPositioning("ambitiousNumberEUR", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        placeholder="e.g. 75,000"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Salary Negotiation Risk & Comment</label>
                    <textarea
                      rows={2}
                      value={app.salaryPositioning?.riskComment || ""}
                      onChange={(e) => updateSalaryPositioning("riskComment", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                      placeholder="Explain the budget alignment, overqualification signals, or local market averages..."
                    />
                  </div>
                </div>

                {/* Keyword Strategy Card */}
                <div className="bg-[#0e162d]/50 p-4 rounded-xl border border-[#1f2937]/50 space-y-4">
                  <h4 className="text-xs font-bold text-white flex items-center justify-between border-b border-[#1f2937]/50 pb-2">
                    <span>🔑 ATS Keyword Strategy</span>
                    <span className="text-[9px] text-[#6d8ead]">Optimization pool</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-emerald-400 block mb-1">Must Include Keywords (one per line)</label>
                      <textarea
                        rows={3}
                        value={(app.keywordStrategy?.mustIncludeATSKeywords || []).join("\n")}
                        onChange={(e) => updateKeywordStrategy("mustIncludeATSKeywords", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                        placeholder="n8n&#10;BPMN&#10;Lean Six Sigma"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-blue-400 block mb-1">Nice to Have Keywords (one per line)</label>
                      <textarea
                        rows={3}
                        value={(app.keywordStrategy?.niceToHaveKeywords || []).join("\n")}
                        onChange={(e) => updateKeywordStrategy("niceToHaveKeywords", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                        placeholder="Python&#10;Docker&#10;GDPR"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-indigo-400 block mb-1">Human Narrative Terms (one per line)</label>
                      <textarea
                        rows={3}
                        value={(app.keywordStrategy?.humanNarrativeKeywords || []).join("\n")}
                        onChange={(e) => updateKeywordStrategy("humanNarrativeKeywords", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                        placeholder="structured operational bridge&#10;single source of truth"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-rose-400 block mb-1">Avoid / Minimize Keywords (one per line)</label>
                      <textarea
                        rows={3}
                        value={(app.keywordStrategy?.avoidOrMinimizeKeywords || []).join("\n")}
                        onChange={(e) => updateKeywordStrategy("avoidOrMinimizeKeywords", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                        placeholder="manager&#10;fully-responsible"
                      />
                    </div>
                  </div>
                </div>

                {/* Recruiter Concerns Card */}
                <div className="bg-[#0e162d]/50 p-4 rounded-xl border border-[#1f2937]/50 space-y-4">
                  <div className="flex justify-between items-center border-b border-[#1f2937]/50 pb-2">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      🛡️ Recruiter Concerns & Neutralization
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddRecruiterConcern}
                      className="text-[10px] text-[#6d8ead] hover:underline"
                    >
                      + Add Concern
                    </button>
                  </div>

                  <div className="space-y-4">
                    {(app.recruiterConcernHandling?.likelyConcerns || []).map((c, idx) => (
                      <div key={idx} className="bg-[#0a0f1d] p-3 rounded-lg border border-[#1f2937] space-y-2 relative">
                        <button
                          type="button"
                          onClick={() => handleRemoveRecruiterConcern(idx)}
                          className="absolute top-2 right-2 text-rose-400 hover:text-rose-300 font-bold text-xs"
                          title="Remove Concern"
                        >
                          ×
                        </button>
                        
                        <div>
                          <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-0.5">Concern / Question Mark</label>
                          <input
                            type="text"
                            value={c.concern}
                            onChange={(e) => updateRecruiterConcern(idx, "concern", e.target.value)}
                            className="w-[90%] px-2.5 py-1 rounded bg-[#0e162d] border border-[#1f2937] text-white text-xs"
                            placeholder="e.g. Overqualification or lack of corporate background"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9px] uppercase font-bold text-amber-400/80 block mb-0.5">Handling Strategy</label>
                            <textarea
                              rows={2}
                              value={c.howToNeutralize}
                              onChange={(e) => updateRecruiterConcern(idx, "howToNeutralize", e.target.value)}
                              className="w-full px-2 py-1 rounded bg-[#0e162d] border border-[#1f2937] text-white text-[10px]"
                              placeholder="Shift focus to hands-on support..."
                            />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-bold text-emerald-400 block mb-0.5">Neutralizing Statement</label>
                            <textarea
                              rows={2}
                              value={c.sentenceToUse}
                              onChange={(e) => updateRecruiterConcern(idx, "sentenceToUse", e.target.value)}
                              className="w-full px-2 py-1 rounded bg-[#0e162d] border border-[#1f2937] text-white text-[10px]"
                              placeholder="While I have analytical experience, my focus is delivering structured workflows..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {(app.recruiterConcernHandling?.likelyConcerns || []).length === 0 && (
                      <p className="text-[10px] text-slate-500 italic">No concerns registered. Click '+ Add Concern' to add one.</p>
                    )}
                  </div>
                </div>

                {/* Quality Control Card */}
                <div className="bg-[#0e162d]/50 p-4 rounded-xl border border-[#1f2937]/50 space-y-4">
                  <h4 className="text-xs font-bold text-white flex items-center justify-between border-b border-[#1f2937]/50 pb-2">
                    <span>🛡️ Quality Control Auditing</span>
                    <span className="text-[9px] text-[#6d8ead]">Content assurance</span>
                  </h4>

                  <div>
                    <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">One-Sentence Professional Positioning</label>
                    <input
                      type="text"
                      value={app.qualityControl?.oneSentencePositioning || ""}
                      onChange={(e) => updateQualityControl("oneSentencePositioning", e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                      placeholder="A process steering analyst focused on workflow automation and quality control..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Direct Evidence Used (one per line)</label>
                      <textarea
                        rows={2}
                        value={(app.qualityControl?.directEvidenceUsed || []).join("\n")}
                        onChange={(e) => updateQualityControl("directEvidenceUsed", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                        placeholder="Operations Scaling & System Migration"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Transferable Evidence Used (one per line)</label>
                      <textarea
                        rows={2}
                        value={(app.qualityControl?.transferableEvidenceUsed || []).join("\n")}
                        onChange={(e) => updateQualityControl("transferableEvidenceUsed", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                        placeholder="Legal studies discipline mapping"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-amber-400 block mb-1">Potential Overclaims Avoided (one per line)</label>
                      <textarea
                        rows={2}
                        value={(app.qualityControl?.potentialOverclaimsAvoided || []).join("\n")}
                        onChange={(e) => updateQualityControl("potentialOverclaimsAvoided", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                        placeholder="Avoided claiming full team leadership role family"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Human Recruiter Impression</label>
                      <input
                        type="text"
                        value={app.qualityControl?.humanRecruiterImpression || ""}
                        onChange={(e) => updateQualityControl("humanRecruiterImpression", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        placeholder="Structured, precise, tech-savvy"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1f2937]/50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#10233f] hover:bg-[#17335c] border border-[#6d8ead]/30 text-white font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 text-[#6d8ead]" /> Save Strategy
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Form Answers Tab */}
            {activeInputTab === "form-answers" && (
              <div className="space-y-6">
                <div className="border-b border-[#1f2937] pb-2 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-white">📝 Portal Form Answers</h3>
                    <p className="text-[10px] text-slate-500">
                      Standard questions and answers to fill out portal applications.
                    </p>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold tracking-wider">STRATEGY-ONLY</span>
                </div>

                <div className="bg-[#0e162d]/50 p-4 rounded-xl border border-[#1f2937]/50 space-y-4">
                  
                  {/* Short Motivation */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] uppercase font-bold text-[#6d8ead] block">Short Motivation Message</label>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(app.formFieldAnswers?.shortMotivationMessage || "");
                          alert("Motivation message copied to clipboard!");
                        }}
                        className="text-[9px] text-[#6d8ead] hover:underline"
                      >
                        Copy Plain Text
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={app.formFieldAnswers?.shortMotivationMessage || ""}
                      onChange={(e) => updateFormFieldAnswers("shortMotivationMessage", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                      placeholder="Describe your quick motivation in 1-2 paragraphs..."
                    />
                  </div>

                  {/* Why this Role */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] uppercase font-bold text-[#6d8ead] block">Why this Role?</label>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(app.formFieldAnswers?.whyThisRole || "");
                          alert("Copied to clipboard!");
                        }}
                        className="text-[9px] text-[#6d8ead] hover:underline"
                      >
                        Copy Plain Text
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={app.formFieldAnswers?.whyThisRole || ""}
                      onChange={(e) => updateFormFieldAnswers("whyThisRole", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                      placeholder="Why do your skills align with this specific position?"
                    />
                  </div>

                  {/* Why this Company */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] uppercase font-bold text-[#6d8ead] block">Why this Company?</label>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(app.formFieldAnswers?.whyThisCompany || "");
                          alert("Copied to clipboard!");
                        }}
                        className="text-[9px] text-[#6d8ead] hover:underline"
                      >
                        Copy Plain Text
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={app.formFieldAnswers?.whyThisCompany || ""}
                      onChange={(e) => updateFormFieldAnswers("whyThisCompany", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                      placeholder="Why this company and mission?"
                    />
                  </div>

                  {/* Additional Message */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] uppercase font-bold text-[#6d8ead] block">Additional Message / Cover Note</label>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(app.formFieldAnswers?.additionalMessage || "");
                          alert("Copied to clipboard!");
                        }}
                        className="text-[9px] text-[#6d8ead] hover:underline"
                      >
                        Copy Plain Text
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={app.formFieldAnswers?.additionalMessage || ""}
                      onChange={(e) => updateFormFieldAnswers("additionalMessage", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                      placeholder="Any additional messages or details to highlight..."
                    />
                  </div>

                  {/* Availability */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Availability</label>
                      <input
                        type="text"
                        value={app.formFieldAnswers?.availability || ""}
                        onChange={(e) => updateFormFieldAnswers("availability", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        placeholder="e.g. Immediate / 1 month notice"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Work Permit Germany</label>
                      <input
                        type="text"
                        value={app.formFieldAnswers?.workPermitGermany || "Yes"}
                        onChange={(e) => updateFormFieldAnswers("workPermitGermany", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                      />
                    </div>
                  </div>

                  {/* Degree explanation */}
                  <div>
                    <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Degree / Education Explanation</label>
                    <textarea
                      rows={2}
                      value={app.formFieldAnswers?.degreeExplanation || ""}
                      onChange={(e) => updateFormFieldAnswers("degreeExplanation", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                      placeholder="Briefly describe legal studies progress or certification equivalency..."
                    />
                  </div>

                  {/* Links */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">Website URL</label>
                      <input
                        type="text"
                        value={app.formFieldAnswers?.website || ""}
                        onChange={(e) => updateFormFieldAnswers("website", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-[#6d8ead] block mb-1">LinkedIn URL</label>
                      <input
                        type="text"
                        value={app.formFieldAnswers?.linkedin || ""}
                        onChange={(e) => updateFormFieldAnswers("linkedin", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1f2937]/50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#10233f] hover:bg-[#17335c] border border-[#6d8ead]/30 text-white font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 text-[#6d8ead]" /> Save Form Answers
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 5. Layout & Asset Toggles */}
            {activeInputTab === "assets" && (
              <div className="space-y-6">
                
                {/* Templates Selector */}
                <div className="bg-[#0e162d]/50 p-4 rounded-xl border border-[#1f2937]/50 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-[#6d8ead]" /> Layout Settings
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">CV Template</label>
                      <select
                        value={app.templateSettings.cvTemplate}
                        onChange={(e) => updateTemplateSettings("cvTemplate", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
                      >
                        <option value="ats-clean">ATS Clean</option>
                        <option value="modern-professional">Modern Professional</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Letter Template</label>
                      <select
                        value={app.templateSettings.coverLetterTemplate}
                        onChange={(e) => updateTemplateSettings("coverLetterTemplate", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
                      >
                        <option value="ats-letter">ATS Letter</option>
                        <option value="asr-sidebar">Executive Sidebar Letter</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Accent Theme Color</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={app.templateSettings.accentColor}
                          onChange={(e) => updateTemplateSettings("accentColor", e.target.value)}
                          className="w-8 h-8 rounded border border-[#1f2937] bg-transparent cursor-pointer"
                        />
                        <span className="text-xs text-slate-300 font-mono">{app.templateSettings.accentColor}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Font Family</label>
                      <select
                        value={app.templateSettings.fontFamily}
                        onChange={(e) => updateTemplateSettings("fontFamily", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
                      >
                        <option value="Inter">Inter (Sans)</option>
                        <option value="Arial">Arial (Sans)</option>
                        <option value="Georgia">Georgia (Serif)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-[#1f2937]/50">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white">A4 Density & Pagination Controls</h4>
                      <button
                        type="button"
                        onClick={() => {
                          const autoFit = computeSmartAutoFitSettings(app);
                          setApp({
                            ...app,
                            templateSettings: {
                              ...app.templateSettings,
                              ...autoFit,
                            },
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/25 transition-all cursor-pointer"
                      >
                        ✨ Smart Auto-Fit
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setApp({
                            ...app,
                            templateSettings: {
                              ...app.templateSettings,
                              fontSize: 9.5,
                              lineSpacing: 1.24,
                              sectionSpacing: 9,
                            },
                          })
                        }
                        className="px-2 py-1.5 rounded-lg border border-[#1f2937] hover:border-[#6d8ead]/50 bg-[#0a0f1d] text-[10px] font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
                      >
                        Compact (9.5pt)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setApp({
                            ...app,
                            templateSettings: {
                              ...app.templateSettings,
                              fontSize: 10,
                              lineSpacing: 1.32,
                              sectionSpacing: 12,
                            },
                          })
                        }
                        className="px-2 py-1.5 rounded-lg border border-[#6d8ead]/40 bg-[#6d8ead]/15 text-[10px] font-semibold text-white hover:bg-[#6d8ead]/25 transition-all cursor-pointer"
                      >
                        Executive 2P (10pt)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setApp({
                            ...app,
                            templateSettings: {
                              ...app.templateSettings,
                              fontSize: 10.5,
                              lineSpacing: 1.38,
                              sectionSpacing: 14,
                            },
                          })
                        }
                        className="px-2 py-1.5 rounded-lg border border-[#1f2937] hover:border-[#6d8ead]/50 bg-[#0a0f1d] text-[10px] font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
                      >
                        Spacious (10.5pt)
                      </button>
                    </div>

                    {/* Section Visibility Toggles (DACH / Berlin Editorial) */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <label className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#0a0f1d] border border-[#1f2937] cursor-pointer">
                        <span className="text-[10px] font-semibold text-slate-300">Key Achievements</span>
                        <input
                          type="checkbox"
                          checked={app.templateSettings.showKeyAchievements !== false}
                          onChange={(e) => updateTemplateSettings("showKeyAchievements", e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-[#6d8ead] cursor-pointer"
                        />
                      </label>
                      <label className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#0a0f1d] border border-[#1f2937] cursor-pointer">
                        <span className="text-[10px] font-semibold text-slate-300">Selected Projects</span>
                        <input
                          type="checkbox"
                          checked={app.templateSettings.showProjects !== false}
                          onChange={(e) => updateTemplateSettings("showProjects", e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-[#6d8ead] cursor-pointer"
                        />
                      </label>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-[10px] font-semibold text-[#6d8ead] mb-1">
                        <span>Font Size</span>
                        <span className="text-white">{app.templateSettings.fontSize || 10}pt</span>
                      </div>
                      <input
                        type="range"
                        min="8.5"
                        max="12"
                        step="0.1"
                        value={app.templateSettings.fontSize || 10}
                        onChange={(e) => updateTemplateSettings("fontSize", Number(e.target.value))}
                        className="w-full accent-[#6d8ead] cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] font-semibold text-[#6d8ead] mb-1">
                        <span>Line Spacing</span>
                        <span className="text-white">{app.templateSettings.lineSpacing || 1.3}</span>
                      </div>
                      <input
                        type="range"
                        min="1.1"
                        max="1.6"
                        step="0.05"
                        value={app.templateSettings.lineSpacing || 1.3}
                        onChange={(e) => updateTemplateSettings("lineSpacing", Number(e.target.value))}
                        className="w-full accent-[#6d8ead] cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] font-semibold text-[#6d8ead] mb-1">
                        <span>Section Spacing</span>
                        <span className="text-white">{app.templateSettings.sectionSpacing || 12}px</span>
                      </div>
                      <input
                        type="range"
                        min="6"
                        max="24"
                        step="1"
                        value={app.templateSettings.sectionSpacing || 12}
                        onChange={(e) => updateTemplateSettings("sectionSpacing", Number(e.target.value))}
                        className="w-full accent-[#6d8ead] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Photo Toggles */}
                <div className="bg-[#0e162d]/50 p-4 rounded-xl border border-[#1f2937]/50 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-[#6d8ead]" /> Profile Photo (DACH Executive Portrait)
                    </h3>
                    <input
                      type="checkbox"
                      checked={app.assetSettings.photo.enabled}
                      onChange={(e) => updateAssetSettings("photo", "enabled", e.target.checked)}
                      className="w-4 h-4 rounded border-[#1f2937] accent-[#6d8ead] cursor-pointer"
                      disabled={!app.assetSettings.photo.filePath}
                    />
                  </div>

                  {app.assetSettings.photo.filePath ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Portrait Frame Style</label>
                        <select
                          value={app.assetSettings.photo.cropStyle}
                          onChange={(e) => updateAssetSettings("photo", "cropStyle", e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
                        >
                          <option value="portrait-rectangle">Executive Portrait 3:4 (Recommended)</option>
                          <option value="rounded-square">Modern Squircle (1:1)</option>
                          <option value="circle">Studio Circle (1:1)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Placement</label>
                        <select
                          value={app.assetSettings.photo.placement}
                          onChange={(e) => updateAssetSettings("photo", "placement", e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
                        >
                          <option value="header-right">Right Column Header (Recommended)</option>
                          <option value="sidebar">Sidebar / Top Right</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-300">
                      No global profile photo uploaded. Go to Dashboard to upload one.
                    </p>
                  )}
                </div>

                {/* Signature Toggles */}
                <div className="bg-[#0e162d]/50 p-4 rounded-xl border border-[#1f2937]/50 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Edit3 className="w-4 h-4 text-[#6d8ead]" /> Handwritten Signature
                    </h3>
                    <input
                      type="checkbox"
                      checked={app.assetSettings.signature.enabled}
                      onChange={(e) => updateAssetSettings("signature", "enabled", e.target.checked)}
                      className="w-4 h-4 rounded border-[#1f2937] accent-[#6d8ead] cursor-pointer"
                      disabled={!app.assetSettings.signature.filePath}
                    />
                  </div>

                  {app.assetSettings.signature.filePath ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Sizing (Width Px)</label>
                          <input
                            type="number"
                            value={app.assetSettings.signature.widthPx}
                            onChange={(e) => updateAssetSettings("signature", "widthPx", Number(e.target.value))}
                            className="w-full px-3 py-1 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                            min={80}
                            max={300}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-bold text-[#6d8ead] block mb-1">Alignment</label>
                          <select
                            value={app.assetSettings.signature.alignment}
                            onChange={(e) => updateAssetSettings("signature", "alignment", e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
                          >
                            <option value="left">Left Aligned</option>
                            <option value="center">Centered</option>
                            <option value="right">Right Aligned</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSigPad(true)}
                        className="w-full text-center py-1.5 border border-[#1f2937] hover:border-[#6d8ead]/40 rounded-xl text-xs text-[#6d8ead] bg-[#0c1328]/20 font-semibold"
                      >
                        ✏️ Redraw / Draw Signature
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-amber-300">
                        No signature uploaded. Go to Dashboard to upload one.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowSigPad(true)}
                        className="w-full text-center py-2 border border-[#1f2937] hover:border-[#6d8ead]/40 rounded-xl text-xs text-[#6d8ead] bg-[#0c1328]/40 font-semibold"
                      >
                        ✏️ Or Draw Signature In-App
                      </button>
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        </div>

        {/* Right Side: Emulated A4 Live Document Preview Panel */}
        <div className="flex-1 bg-[#090d16] overflow-y-auto flex flex-col items-center py-6 relative">
          
          {/* Live Human & Berlin Readiness Toolbar + Zoom Controls */}
          {(() => {
            const readiness = analyzeApplicationReadiness(app);
            const isWordCountIdeal = readiness.totalCvWords >= 330 && readiness.totalCvWords <= 460;
            const aiIssueCount = readiness.aiBuzzwordsFound.length + readiness.duplicateAchievementsCount;
            const showAch = app.templateSettings.showKeyAchievements !== false;
            const showProj = app.templateSettings.showProjects !== false;

            return (
              <div className="w-full max-w-[940px] px-6 mb-4 flex flex-wrap items-center justify-between gap-2 z-30">
                <div className="bg-[#0c1328]/90 border border-[#1f2937] rounded-xl px-3 py-1.5 flex flex-wrap items-center gap-2.5 shadow-lg backdrop-blur-sm">
                  {/* Word Count Badge */}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      isWordCountIdeal
                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                    }`}
                    title="Target word budget (Berlin Editorial Standard): 350–450 words on CV"
                  >
                    CV: {readiness.totalCvWords}w {isWordCountIdeal ? "· Ideal" : readiness.totalCvWords < 330 ? "· Short" : "· Dense"}
                  </span>

                  {/* Bullets Length Badge */}
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                      readiness.longBulletsCount === 0
                        ? "bg-slate-800/80 text-slate-300 border-slate-700"
                        : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                    }`}
                    title="Recommended bullet length: max 18–20 words for 6-second recruiter scan"
                  >
                    {readiness.totalBullets} bullets {readiness.longBulletsCount > 0 ? `(${readiness.longBulletsCount} >20w)` : "· Concise"}
                  </span>

                  {/* Anti-AI & Duplication Status / 1-Click Clean */}
                  {aiIssueCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const cleaned = sanitizeApplicationAiContent(app);
                        setApp(cleaned);
                      }}
                      className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
                      title={`Detected AI clichés: ${readiness.aiBuzzwordsFound.join(", ") || "none"} | Duplicate achievements: ${readiness.duplicateAchievementsCount}`}
                    >
                      🧹 Clean AI ({aiIssueCount})
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                      ✓ 100% Human
                    </span>
                  )}

                  <span className="text-slate-700">|</span>

                  {/* Quick Section Toggles */}
                  <button
                    type="button"
                    onClick={() => updateTemplateSettings("showKeyAchievements", !showAch)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                      showAch
                        ? "bg-[#10233f] text-white border-[#6d8ead]/40"
                        : "bg-[#0a0f1d] text-slate-500 border-[#1f2937]"
                    }`}
                    title="Show/hide Key Achievements section (pure DACH Lebenslauf toggle)"
                  >
                    Achievements: {showAch ? "ON" : "OFF"}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateTemplateSettings("showProjects", !showProj)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                      showProj
                        ? "bg-[#10233f] text-white border-[#6d8ead]/40"
                        : "bg-[#0a0f1d] text-slate-500 border-[#1f2937]"
                    }`}
                    title="Show/hide Selected Projects section"
                  >
                    Projects: {showProj ? "ON" : "OFF"}
                  </button>

                  {/* 1-Click Smart Auto-Fit */}
                  <button
                    type="button"
                    onClick={() => {
                      const autoFit = computeSmartAutoFitSettings(app);
                      setApp({
                        ...app,
                        templateSettings: {
                          ...app.templateSettings,
                          ...autoFit,
                        },
                      });
                    }}
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-[#6d8ead]/15 hover:bg-[#6d8ead]/30 text-white border border-[#6d8ead]/40 transition-all cursor-pointer"
                    title="Automatically adjust font size, line spacing, and section spacing based on word count"
                  >
                    ✨ Auto-Fit ({app.templateSettings.fontSize || 10}pt)
                  </button>
                </div>

                {/* Zoom controls */}
                <div className="bg-[#0c1328]/90 border border-[#1f2937] rounded-xl px-3 py-1.5 flex items-center gap-2.5 shadow-lg backdrop-blur-sm">
                  <span className="text-[10px] text-slate-400 font-bold">ZOOM</span>
                  <input
                    type="range"
                    min="0.4"
                    max="1.2"
                    step="0.05"
                    value={zoomScale}
                    onChange={(e) => setZoomScale(Number(e.target.value))}
                    className="w-20 accent-[#6d8ead] cursor-pointer"
                  />
                  <span className="text-[10px] text-white font-mono font-bold">{Math.round(zoomScale * 100)}%</span>
                </div>
              </div>
            );
          })()}

          {/* Emulated Document Container */}
          <div 
            style={{ 
              transform: `scale(${zoomScale})`, 
              transformOrigin: "top center",
              transition: "transform 0.1s ease-out",
              marginBottom: `${-300 * (1 - zoomScale)}px` // correct margin wrapping after scaling
            }}
            className="shadow-2xl shadow-black/80 border border-slate-800 rounded-sm overflow-hidden shrink-0"
          >
            {/* Always render all templates so merge export can access DOM nodes */}
            <div style={{ display: activePreviewTab === "cv" ? "block" : "none" }}>
              {app.templateSettings.cvTemplate === "ats-clean" ? (
                <AtsCleanCv data={app} />
              ) : (
                <ModernProfessionalCv data={app} />
              )}
            </div>
            <div style={{ display: activePreviewTab === "letter" ? "block" : "none" }}>
              {app.templateSettings.coverLetterTemplate === "ats-letter" ? (
                <AtsLetter data={app} />
              ) : (
                <AsrSidebarLetter data={app} />
              )}
            </div>
            <div style={{ display: activePreviewTab === "prep" ? "block" : "none" }}>
              <StarPrepGuide data={app} />
            </div>
          </div>
        </div>

      </div>

        {/* Signature Drawing Pad Overlay */}
        <SignaturePad
          isOpen={showSigPad}
          onClose={() => setShowSigPad(false)}
          onSave={handleSaveDrawnSignature}
        />

        {/* Prompt Architect Modal */}
        <PromptGeneratorModal
          isOpen={showPromptModal}
          onClose={() => setShowPromptModal(false)}
          initialCompany={app.company}
          initialRoleTitle={app.roleTitle}
          initialLanguage={app.language as "English" | "German" | "Spanish"}
        />

        {/* Import JSON Modal */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-[#1f2937] bg-[#0e162d] p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
              <div className="absolute -left-16 -top-16 w-32 h-32 bg-[#6d8ead]/15 rounded-full blur-2xl"></div>
              
              <div className="flex justify-between items-start mb-2 z-10">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Package className="w-5 h-5 text-emerald-400" />
                    Import Tailored JSON Draft
                  </h3>
                  <p className="text-xs text-[#6b7280]">
                    Paste the JSON generated by your LLM or upload a .json file to immediately populate the entire draft.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setShowPromptModal(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#10233f] hover:bg-[#163056] text-[#6d8ead] hover:text-white border border-[#6d8ead]/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Customize Prompt
                  </button>
                  <button 
                    onClick={() => setShowImportModal(false)}
                    className="text-slate-400 hover:text-white font-bold text-lg px-1"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col my-4 gap-3">
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-[#1f2937] hover:border-[#6d8ead]/40 rounded-xl p-6 cursor-pointer bg-[#0a0f1d]/50 transition-colors">
                    <Download className="w-6 h-6 text-[#6d8ead] mb-2" />
                    <span className="text-xs font-semibold text-white">Upload .json file</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            if (evt.target?.result) {
                              handleImportJson(evt.target.result as string);
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex-1 flex flex-col">
                  <label className="text-[10px] uppercase font-bold text-[#6d8ead] mb-1 block">Or paste JSON content directly here:</label>
                  <textarea
                    rows={6}
                    placeholder='{ "company": "Acme Corp", ... }'
                    value={editorJsonText}
                    onChange={(e) => setEditorJsonText(e.target.value)}
                    className="w-full flex-1 min-h-[120px] p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs font-mono focus:border-emerald-500 outline-none leading-normal resize-y"
                  />
                  {editorValidationSummary && (
                    <div className={`mt-3 p-3 rounded-xl border text-xs leading-relaxed ${
                      editorValidationSummary.valid 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}>
                      <p className="font-bold mb-1">
                        {editorValidationSummary.valid ? "✓ Valid JSON structure" : "⚠ Validation Issues / Errors"}
                      </p>
                      {editorValidationSummary.valid ? (
                        <div className="space-y-1 mt-1 text-[11px] text-slate-300">
                          <p><strong className="text-white">Company:</strong> {editorValidationSummary.company}</p>
                          {editorValidationSummary.roleTitle && (
                            <p><strong className="text-white">Position/Headline:</strong> {editorValidationSummary.roleTitle}</p>
                          )}
                          {editorValidationSummary.fitScore !== null && editorValidationSummary.fitScore !== undefined && (
                            <p><strong className="text-white">Fit Score:</strong> {editorValidationSummary.fitScore}/10</p>
                          )}
                          {editorValidationSummary.priority && (
                            <p><strong className="text-white">Priority:</strong> {editorValidationSummary.priority}</p>
                          )}
                          {editorValidationSummary.positioning && (
                            <p><strong className="text-white">Positioning:</strong> {editorValidationSummary.positioning}</p>
                          )}
                        </div>
                      ) : (
                        <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                          {editorValidationSummary.errors?.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 z-10 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (editorJsonText) {
                      handleImportJson(editorJsonText);
                    } else {
                      alert("Please paste the JSON content or upload a file.");
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs hover:from-emerald-500/30 hover:to-emerald-600/30 transition-all active:scale-95 flex items-center justify-center min-w-[100px]"
                >
                  📥 Import Data
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setEditorJsonText("");
                  }}
                  className="px-4 py-2 rounded-xl bg-[#10233f] hover:bg-[#152e52] text-[#6d8ead] border border-[#6d8ead]/10 font-bold text-xs transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
