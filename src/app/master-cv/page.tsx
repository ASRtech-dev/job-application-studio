"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, useDeferredValue } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUp, ArrowDown, Save, Plus, Trash2, Download, Search, X } from "lucide-react";
import {
  MasterCvSchema,
  type MasterCv,
  type ExperienceEntry,
  type CertificationEntry,
  type EducationEntry,
  type ProjectEntry,
  type InterviewPrep,
} from "@/lib/schemas";
import { useToast, ToastContainer } from "@/components/Toast";
import { describeSaveFailure, type SaveFailure } from "@/lib/saveStatus";
import { buildDocumentHtml, getDocumentElementId, getProfessionalFilename, getVerifiedPdfKeywords } from "@/lib/documentExport";
import { downloadPdfBlob } from "@/lib/browserDownload";
import { type DocumentPaginationResult } from "@/lib/documentPagination";
import {
  buildMasterCvExportApp,
  DEFAULT_MASTER_CV_EXPORT_OPTIONS,
  getMasterDocumentFooterLabel,
  type MasterCvExportOptions,
} from "@/lib/masterCvExport";
import { AtsCleanCv, ModernProfessionalCv, DachTabularCv } from "@/components/templates/DocumentTemplates";
import { MasterCvPdfPanel } from "@/components/master-cv/MasterCvPdfPanel";
import { SaveSectionButton } from "@/components/editor/SaveSectionButton";

type VersionedMasterCv = MasterCv & { revision?: number };
type MasterTab =
  | "general"
  | "variants"
  | "achievements"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "interview-prep"
  | "pdf";

const PDF_OPTIONS_STORAGE_KEY = "jas_master_pdf_options_v1";
const WORK_MODES_PRESETS = ["Hybrid", "On-site", "Remote", "Full-time"];

function countWords(text: string): number {
  const clean = text.trim();
  return clean ? clean.split(/\s+/).length : 0;
}

function moveItem<T>(arr: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= arr.length) return [...arr];
  const copy = [...arr];
  const [picked] = copy.splice(index, 1);
  copy.splice(target, 0, picked);
  return copy;
}

export default function MasterCvEditor() {
  const fieldId = React.useId();
  const [data, setData] = useState<VersionedMasterCv | null>(null);
  const latestDataRef = useRef<VersionedMasterCv | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const { toasts, showToast, dismissToast } = useToast();
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<MasterTab>("general");
  const [sectionFilter, setSectionFilter] = useState("");
  const [pdfOptions, setPdfOptions] = useState<MasterCvExportOptions>(DEFAULT_MASTER_CV_EXPORT_OPTIONS);
  const [pdfOptionsRestored, setPdfOptionsRestored] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfPageResult, setPdfPageResult] = useState<DocumentPaginationResult>({ pages: 0, height: 0, warnings: [] });

  useEffect(() => { latestDataRef.current = data; }, [data]);
  const masterDocApp = useMemo(() => (data ? buildMasterCvExportApp(data, pdfOptions) : null), [data, pdfOptions]);
  const deferredMasterDocApp = useDeferredValue(masterDocApp);
  const isDirty = Boolean(data && lastSavedSnapshot && JSON.stringify(data) !== lastSavedSnapshot);

  useEffect(() => {
    if (!pdfOptionsRestored) return;
    try {
      window.localStorage.setItem(PDF_OPTIONS_STORAGE_KEY, JSON.stringify(pdfOptions));
    } catch { /* ignore */ }
  }, [pdfOptions, pdfOptionsRestored]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadData() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/master-cv", { signal: controller.signal });
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "Master CV not found (404). Check your saved profile and retry."
              : "Could not load the Master CV. Retry to recover your saved profile."
          );
        }
        const parsed = MasterCvSchema.safeParse(await res.json());
        if (!parsed.success) throw new Error("Could not parse the Master CV response. Retry before editing.");
        if (controller.signal.aborted) return;
        try {
          let nextOpts = DEFAULT_MASTER_CV_EXPORT_OPTIONS;
          const savedOpts = window.localStorage.getItem(PDF_OPTIONS_STORAGE_KEY);
          if (savedOpts) {
            const parsedOpts = JSON.parse(savedOpts);
            if (parsedOpts && typeof parsedOpts === "object") {
              nextOpts = { ...nextOpts, ...parsedOpts };
            }
          }
          const savedPhoto = window.localStorage.getItem("jas_default_photo");
          const photoEnabledPref = window.localStorage.getItem("jas_photo_enabled");
          if (savedPhoto) {
            nextOpts = {
              ...nextOpts,
              photoPath: nextOpts.photoPath || savedPhoto,
              includePhoto: photoEnabledPref !== null ? photoEnabledPref === "true" : nextOpts.includePhoto,
            };
          }
          setPdfOptions(nextOpts);
        } catch { /* optional browser storage */ }
        setPdfOptionsRestored(true);
        setData(parsed.data);
        setLastSavedSnapshot(JSON.stringify(parsed.data));
        setSaveFailure(null);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "Could not load the Master CV. Retry to recover your saved profile.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadData();
    return () => controller.abort();
  }, [reloadKey]);

  const executeSave = useCallback(async () => {
    const current = latestDataRef.current;
    if (!current) return;
    const requestSnapshot = JSON.stringify({ ...current, revision: current.revision ?? 0 });
    setSaving(true);
    setSaveFailure(null);
    try {
      const res = await fetch("/api/master-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestSnapshot,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const failure = describeSaveFailure(
          res.status,
          res.status === 409
            ? "The Master CV changed in another tab. Your edits are still here — copy anything you need before reloading the saved profile."
            : typeof errBody.error === "string"
            ? `Could not save the Master CV. Your edits are still here: ${errBody.error}`
            : "Could not save the Master CV. Your edits are still here; please try again.",
          requestSnapshot
        );
        setSaveFailure(failure);
        showToast(failure.message, "error");
        return;
      }
      const response = await res.json();
      const parsed = MasterCvSchema.safeParse(response.data);
      if (!parsed.success) {
        const failure = describeSaveFailure(500, "Could not verify the saved response. Your edits are still here; reload before retrying.", requestSnapshot);
        setSaveFailure(failure);
        showToast(failure.message, "error");
        return;
      }
      const saved = parsed.data as VersionedMasterCv;
      setData((latest) => {
        if (!latest) return saved;
        const latestSnapshot = JSON.stringify({ ...latest, revision: latest.revision ?? 0 });
        return latestSnapshot === requestSnapshot ? saved : { ...latest, revision: saved.revision ?? 0 };
      });
      setLastSavedSnapshot(JSON.stringify(saved));
      setSaveFailure(null);
      showToast("Master CV saved. Existing applications remain untouched.", "success");
    } catch (error) {
      const failure = describeSaveFailure(
        null,
        error instanceof Error ? `Error saving Master CV. Your edits are still here (${error.message}).` : "Could not save Master CV. Your edits are still here.",
        requestSnapshot
      );
      setSaveFailure(failure);
      showToast(failure.message, "error");
    } finally {
      setSaving(false);
    }
  }, [showToast]);

  const handleSave = useCallback(() => {
    const next = saveQueueRef.current.then(() => executeSave());
    saveQueueRef.current = next.catch(() => {});
    return next;
  }, [executeSave]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  useEffect(() => {
    if (!isDirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  const reloadProfile = () => {
    if (isDirty && !window.confirm("Reload the saved Master CV and discard unsaved changes in this form? Copy anything you need first.")) return;
    setReloadKey((value) => value + 1);
  };

  const handleExportMasterPdf = useCallback(async () => {
    const current = latestDataRef.current;
    if (!current || exportingPdf) return;
    if (isDirty && !window.confirm("You have unsaved changes in this form. The PDF will reflect your current preview without saving to disk. Continue with download?")) {
      return;
    }
    const exportApp = buildMasterCvExportApp(current, pdfOptions);
    const element = document.getElementById(getDocumentElementId(exportApp, "cv"));
    if (!element) {
      showToast("Could not prepare the Master CV template.", "error");
      return;
    }
    const styledHtml = buildDocumentHtml(exportApp, "cv", element.outerHTML, {
      unboundedPages: true,
      documentLabel: getMasterDocumentFooterLabel(pdfOptions.language),
    });
    const defaultFilename = getProfessionalFilename(exportApp, "master-cv");
    setExportingPdf(true);
    try {
      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: styledHtml,
          documentType: "master-cv",
          roleTitle: exportApp.roleTitle,
          author: current.fullName,
          language: exportApp.language,
          keywords: getVerifiedPdfKeywords(exportApp),
          fileName: defaultFilename,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "The server could not generate the Master CV PDF.");
      }
      const blob = await res.blob();
      const finalFilename = res.headers.get("X-Filename") || defaultFilename;
      const pagesHeader = res.headers.get("X-PDF-Pages");
      await downloadPdfBlob(blob, finalFilename, 150);
      showToast(pagesHeader ? `Master CV PDF downloaded (${pagesHeader} pages).` : "Master CV PDF downloaded.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not export the Master CV PDF.", "error");
    } finally {
      setExportingPdf(false);
    }
  }, [exportingPdf, isDirty, pdfOptions, showToast]);

  // Pure immutable handlers
  const updateGeneral = <K extends keyof MasterCv>(field: K, value: MasterCv[K]) => {
    setData((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateWorkAuthorization = (value: string) => {
    setData((prev) => (prev ? { ...prev, workAuthorization: value, workPermitGermany: undefined } : prev));
  };

  const toggleWorkMode = (mode: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const current = prev.workModes || [];
      const next = current.includes(mode) ? current.filter((m) => m !== mode) : [...current, mode];
      return { ...prev, workModes: next };
    });
  };

  const handleAddLink = () => {
    setData((prev) => (prev ? { ...prev, links: [...prev.links, { label: "", url: "" }] } : prev));
  };
  const handleRemoveLink = (idx: number) => {
    setData((prev) => (prev ? { ...prev, links: prev.links.filter((_, i) => i !== idx) } : prev));
  };
  const handleLinkChange = (idx: number, field: "label" | "url", val: string) => {
    setData((prev) => (prev ? { ...prev, links: prev.links.map((item, i) => (i === idx ? { ...item, [field]: val } : item)) } : prev));
  };

  const handleAddHeadlineVariant = () => {
    setData((prev) => (prev ? { ...prev, headlineVariants: [...prev.headlineVariants, { category: "", headline: "" }] } : prev));
  };
  const handleHeadlineChange = (idx: number, field: "category" | "headline", val: string) => {
    setData((prev) => (prev ? { ...prev, headlineVariants: prev.headlineVariants.map((item, i) => (i === idx ? { ...item, [field]: val } : item)) } : prev));
  };
  const handleRemoveHeadlineVariant = (idx: number) => {
    setData((prev) => (prev ? { ...prev, headlineVariants: prev.headlineVariants.filter((_, i) => i !== idx) } : prev));
  };
  const handleMoveHeadlineVariant = (idx: number, dir: -1 | 1) => {
    setData((prev) => (prev ? { ...prev, headlineVariants: moveItem(prev.headlineVariants, idx, dir) } : prev));
  };

  const handleAddProfileVariant = () => {
    setData((prev) => (prev ? { ...prev, profileVariants: [...prev.profileVariants, { category: "", text: "" }] } : prev));
  };
  const handleProfileVariantChange = (idx: number, field: "category" | "text", val: string) => {
    setData((prev) => (prev ? { ...prev, profileVariants: prev.profileVariants.map((item, i) => (i === idx ? { ...item, [field]: val } : item)) } : prev));
  };
  const handleRemoveProfileVariant = (idx: number) => {
    setData((prev) => (prev ? { ...prev, profileVariants: prev.profileVariants.filter((_, i) => i !== idx) } : prev));
  };
  const handleMoveProfileVariant = (idx: number, dir: -1 | 1) => {
    setData((prev) => (prev ? { ...prev, profileVariants: moveItem(prev.profileVariants, idx, dir) } : prev));
  };

  const handleAddAchievement = () => {
    setData((prev) => (prev ? { ...prev, achievementsPool: ["", ...prev.achievementsPool] } : prev));
  };
  const handleRemoveAchievement = (idx: number) => {
    setData((prev) => (prev ? { ...prev, achievementsPool: prev.achievementsPool.filter((_, i) => i !== idx) } : prev));
  };
  const handleAchievementChange = (idx: number, val: string) => {
    setData((prev) => (prev ? { ...prev, achievementsPool: prev.achievementsPool.map((item, i) => (i === idx ? val : item)) } : prev));
  };
  const handleMoveAchievement = (idx: number, dir: -1 | 1) => {
    setData((prev) => (prev ? { ...prev, achievementsPool: moveItem(prev.achievementsPool, idx, dir) } : prev));
  };

  // Skills Group CRUD
  const handleAddSkillGroup = () => {
    setData((prev) => (prev ? { ...prev, skillsPool: [...prev.skillsPool, { group: "", skills: [""] }] } : prev));
  };
  const handleRemoveSkillGroup = (gIdx: number) => {
    setData((prev) => (prev ? { ...prev, skillsPool: prev.skillsPool.filter((_, i) => i !== gIdx) } : prev));
  };
  const handleMoveSkillGroup = (gIdx: number, dir: -1 | 1) => {
    setData((prev) => (prev ? { ...prev, skillsPool: moveItem(prev.skillsPool, gIdx, dir) } : prev));
  };
  const handleSkillGroupTitleChange = (gIdx: number, val: string) => {
    setData((prev) => (prev ? { ...prev, skillsPool: prev.skillsPool.map((g, i) => (i === gIdx ? { ...g, group: val } : g)) } : prev));
  };
  const handleAddSkillToGroup = (gIdx: number) => {
    setData((prev) => (prev ? { ...prev, skillsPool: prev.skillsPool.map((g, i) => (i === gIdx ? { ...g, skills: [...g.skills, ""] } : g)) } : prev));
  };
  const handleRemoveSkillFromGroup = (gIdx: number, sIdx: number) => {
    setData((prev) => (prev ? { ...prev, skillsPool: prev.skillsPool.map((g, i) => (i === gIdx ? { ...g, skills: g.skills.filter((_, si) => si !== sIdx) } : g)) } : prev));
  };
  const handleSkillNameChange = (gIdx: number, sIdx: number, val: string) => {
    setData((prev) => (prev ? { ...prev, skillsPool: prev.skillsPool.map((g, i) => (i === gIdx ? { ...g, skills: g.skills.map((s, si) => (si === sIdx ? val : s)) } : g)) } : prev));
  };

  // Experience CRUD
  const handleAddExperience = () => {
    setData((prev) => {
      if (!prev) return prev;
      const newExp: ExperienceEntry = {
        id: `exp-${Date.now()}`,
        jobTitle: "",
        company: "",
        location: "",
        dates: "",
        summary: "",
        include: true,
        bullets: [""],
      };
      return { ...prev, experienceHistory: [newExp, ...prev.experienceHistory] };
    });
  };
  const handleRemoveExperience = (idx: number) => {
    if (!window.confirm("Delete this work experience entry from your Master CV?")) return;
    setData((prev) => (prev ? { ...prev, experienceHistory: prev.experienceHistory.filter((_, i) => i !== idx) } : prev));
  };
  const handleMoveExperience = (idx: number, dir: -1 | 1) => {
    setData((prev) => (prev ? { ...prev, experienceHistory: moveItem(prev.experienceHistory, idx, dir) } : prev));
  };
  const handleUpdateExperience = <K extends keyof ExperienceEntry>(idx: number, field: K, val: ExperienceEntry[K]) => {
    setData((prev) => (prev ? { ...prev, experienceHistory: prev.experienceHistory.map((item, i) => (i === idx ? { ...item, [field]: val } : item)) } : prev));
  };
  const handleAddExperienceBullet = (expIdx: number) => {
    setData((prev) => (prev ? { ...prev, experienceHistory: prev.experienceHistory.map((item, i) => (i === expIdx ? { ...item, bullets: [...item.bullets, ""] } : item)) } : prev));
  };
  const handleRemoveExperienceBullet = (expIdx: number, bIdx: number) => {
    setData((prev) => (prev ? { ...prev, experienceHistory: prev.experienceHistory.map((item, i) => (i === expIdx ? { ...item, bullets: item.bullets.filter((_, bi) => bi !== bIdx) } : item)) } : prev));
  };
  const handleExperienceBulletChange = (expIdx: number, bIdx: number, val: string) => {
    setData((prev) => (prev ? { ...prev, experienceHistory: prev.experienceHistory.map((item, i) => (i === expIdx ? { ...item, bullets: item.bullets.map((b, bi) => (bi === bIdx ? val : b)) } : item)) } : prev));
  };
  const handleMoveExperienceBullet = (expIdx: number, bIdx: number, dir: -1 | 1) => {
    setData((prev) => (prev ? { ...prev, experienceHistory: prev.experienceHistory.map((item, i) => (i === expIdx ? { ...item, bullets: moveItem(item.bullets, bIdx, dir) } : item)) } : prev));
  };
  const handleAddExperiencePillar = (expIdx: number) => {
    setData((prev) => (prev ? {
      ...prev,
      experienceHistory: prev.experienceHistory.map((item, i) =>
        i === expIdx ? { ...item, pillars: [...(item.pillars || []), { id: `pillar-${Date.now()}`, title: "", duties: [""] }] } : item
      ),
    } : prev));
  };
  const handleUpdatePillarTitle = (expIdx: number, pIdx: number, title: string) => {
    setData((prev) => (prev ? {
      ...prev,
      experienceHistory: prev.experienceHistory.map((item, i) =>
        i === expIdx ? { ...item, pillars: (item.pillars || []).map((p, pi) => (pi === pIdx ? { ...p, title } : p)) } : item
      ),
    } : prev));
  };
  const handleRemovePillar = (expIdx: number, pIdx: number) => {
    setData((prev) => (prev ? {
      ...prev,
      experienceHistory: prev.experienceHistory.map((item, i) =>
        i === expIdx ? { ...item, pillars: (item.pillars || []).filter((_, pi) => pi !== pIdx) } : item
      ),
    } : prev));
  };
  const handleAddPillarDuty = (expIdx: number, pIdx: number) => {
    setData((prev) => (prev ? {
      ...prev,
      experienceHistory: prev.experienceHistory.map((item, i) =>
        i === expIdx ? { ...item, pillars: (item.pillars || []).map((p, pi) => (pi === pIdx ? { ...p, duties: [...p.duties, ""] } : p)) } : item
      ),
    } : prev));
  };
  const handleUpdatePillarDuty = (expIdx: number, pIdx: number, dIdx: number, val: string) => {
    setData((prev) => (prev ? {
      ...prev,
      experienceHistory: prev.experienceHistory.map((item, i) =>
        i === expIdx ? { ...item, pillars: (item.pillars || []).map((p, pi) => (pi === pIdx ? { ...p, duties: p.duties.map((d, di) => (di === dIdx ? val : d)) } : p)) } : item
      ),
    } : prev));
  };
  const handleRemovePillarDuty = (expIdx: number, pIdx: number, dIdx: number) => {
    setData((prev) => (prev ? {
      ...prev,
      experienceHistory: prev.experienceHistory.map((item, i) =>
        i === expIdx ? { ...item, pillars: (item.pillars || []).map((p, pi) => (pi === pIdx ? { ...p, duties: p.duties.filter((_, di) => di !== dIdx) } : p)) } : item
      ),
    } : prev));
  };

  // Projects CRUD
  const handleUpdateProject = <K extends keyof ProjectEntry>(idx: number, field: K, val: ProjectEntry[K]) => {
    setData((prev) => (prev ? { ...prev, projectsHistory: (prev.projectsHistory || []).map((p, i) => (i === idx ? { ...p, [field]: val } : p)) } : prev));
  };
  const handleAddProject = () => {
    setData((prev) => (prev ? {
      ...prev,
      projectsHistory: [...(prev.projectsHistory || []), { id: `proj-${Date.now()}`, title: "", role: "", dates: "", description: "", include: true, bullets: [""] }],
    } : prev));
  };
  const handleRemoveProject = (idx: number) => {
    setData((prev) => (prev ? { ...prev, projectsHistory: (prev.projectsHistory || []).filter((_, i) => i !== idx) } : prev));
  };
  const handleMoveProject = (idx: number, dir: -1 | 1) => {
    setData((prev) => (prev ? { ...prev, projectsHistory: moveItem(prev.projectsHistory || [], idx, dir) } : prev));
  };
  const handleAddProjectBullet = (projIdx: number) => {
    setData((prev) => (prev ? { ...prev, projectsHistory: (prev.projectsHistory || []).map((p, i) => (i === projIdx ? { ...p, bullets: [...(p.bullets || []), ""] } : p)) } : prev));
  };
  const handleRemoveProjectBullet = (projIdx: number, bIdx: number) => {
    setData((prev) => (prev ? { ...prev, projectsHistory: (prev.projectsHistory || []).map((p, i) => (i === projIdx ? { ...p, bullets: (p.bullets || []).filter((_, bi) => bi !== bIdx) } : p)) } : prev));
  };
  const handleProjectBulletChange = (projIdx: number, bIdx: number, val: string) => {
    setData((prev) => (prev ? { ...prev, projectsHistory: (prev.projectsHistory || []).map((p, i) => (i === projIdx ? { ...p, bullets: (p.bullets || []).map((b, bi) => (bi === bIdx ? val : b)) } : p)) } : prev));
  };
  const handleMoveProjectBullet = (projIdx: number, bIdx: number, dir: -1 | 1) => {
    setData((prev) => (prev ? { ...prev, projectsHistory: (prev.projectsHistory || []).map((p, i) => (i === projIdx ? { ...p, bullets: moveItem(p.bullets || [], bIdx, dir) } : p)) } : prev));
  };

  // Languages CRUD
  const handleAddLanguage = () => {
    setData((prev) => (prev ? { ...prev, languages: [...(prev.languages || []), { language: "", level: "" }] } : prev));
  };
  const handleUpdateLanguage = (idx: number, field: "language" | "level", val: string) => {
    setData((prev) => (prev ? { ...prev, languages: (prev.languages || []).map((l, i) => (i === idx ? { ...l, [field]: val } : l)) } : prev));
  };
  const handleRemoveLanguage = (idx: number) => {
    setData((prev) => (prev ? { ...prev, languages: (prev.languages || []).filter((_, i) => i !== idx) } : prev));
  };

  // Education CRUD
  const handleAddEducation = () => {
    setData((prev) => (prev ? {
      ...prev,
      educationHistory: [...(prev.educationHistory || []), { id: `edu-${Date.now()}`, degree: "", institution: "", period: "", description: "" }],
    } : prev));
  };
  const handleUpdateEducation = (idx: number, field: keyof EducationEntry, val: string) => {
    setData((prev) => (prev ? { ...prev, educationHistory: (prev.educationHistory || []).map((e, i) => (i === idx ? { ...e, [field]: val } : e)) } : prev));
  };
  const handleRemoveEducation = (idx: number) => {
    setData((prev) => (prev ? { ...prev, educationHistory: (prev.educationHistory || []).filter((_, i) => i !== idx) } : prev));
  };
  const handleMoveEducation = (idx: number, dir: -1 | 1) => {
    setData((prev) => (prev ? { ...prev, educationHistory: moveItem(prev.educationHistory || [], idx, dir) } : prev));
  };

  // Certifications CRUD
  const handleAddCertification = () => {
    setData((prev) => (prev ? {
      ...prev,
      certificationsHistory: [...(prev.certificationsHistory || []), { id: `cert-${Date.now()}`, name: "", authority: "", date: "" }],
    } : prev));
  };
  const handleUpdateCertification = (idx: number, field: keyof CertificationEntry, val: string) => {
    setData((prev) => (prev ? { ...prev, certificationsHistory: (prev.certificationsHistory || []).map((c, i) => (i === idx ? { ...c, [field]: val } : c)) } : prev));
  };
  const handleRemoveCertification = (idx: number) => {
    setData((prev) => (prev ? { ...prev, certificationsHistory: (prev.certificationsHistory || []).filter((_, i) => i !== idx) } : prev));
  };
  const handleMoveCertification = (idx: number, dir: -1 | 1) => {
    setData((prev) => (prev ? { ...prev, certificationsHistory: moveItem(prev.certificationsHistory || [], idx, dir) } : prev));
  };

  // Applied Methodologies / Specialized Competencies CRUD
  const handleAddSpecializedCompetency = () => {
    setData((prev) => (prev ? { ...prev, specializedCompetencies: [...(prev.specializedCompetencies || []), ""] } : prev));
  };
  const handleUpdateSpecializedCompetency = (idx: number, val: string) => {
    setData((prev) => (prev ? { ...prev, specializedCompetencies: (prev.specializedCompetencies || []).map((item, i) => (i === idx ? val : item)) } : prev));
  };
  const handleRemoveSpecializedCompetency = (idx: number) => {
    setData((prev) => (prev ? { ...prev, specializedCompetencies: (prev.specializedCompetencies || []).filter((_, i) => i !== idx) } : prev));
  };

  // Interview Prep CRUD
  const updateInterviewPrep = (updater: (current: InterviewPrep) => InterviewPrep) => {
    setData((prev) => (prev ? { ...prev, interviewPrep: updater(prev.interviewPrep || {}) } : prev));
  };

  if (loading) {
    return (
      <div className="ui-shell min-w-0 flex-1 flex flex-col justify-center items-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
        <p className="mt-4 text-blue-300">Loading Master CV…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="ui-shell ui-controls min-w-0 flex-1 flex flex-col justify-center items-center gap-4 p-6 text-white">
        <h1 className="text-lg font-bold">Master CV unavailable</h1>
        <p role="alert" className="text-amber-200 max-w-lg text-center">{loadError || "The source profile could not be loaded."}</p>
        <button type="button" onClick={reloadProfile} className="ui-button ui-button--secondary">Retry loading Master CV</button>
        <Link href="/" className="text-blue-300 underline">Back to Dashboard</Link>
      </div>
    );
  }

  const normalizedFilter = sectionFilter.trim().toLowerCase();
  const matchesFilter = (...parts: Array<string | undefined>) =>
    !normalizedFilter || parts.some((p) => (p || "").toLowerCase().includes(normalizedFilter));

  const interviewPrep = data.interviewPrep || {};
  const starStories = interviewPrep.starStories || [];
  const questionsToAsk = interviewPrep.questionsToAsk || [];
  const callSurvivalNotes = interviewPrep.callSurvivalNotes || [];

  const tabsConfig: Array<{ id: MasterTab; label: string; count?: number }> = [
    { id: "general", label: "Profile & Contact" },
    { id: "variants", label: "Headlines & Summaries", count: data.headlineVariants.length + data.profileVariants.length },
    { id: "achievements", label: "Achievements Pool", count: data.achievementsPool.length },
    { id: "skills", label: "Skills Pool", count: data.skillsPool.length },
    { id: "experience", label: "Experience", count: data.experienceHistory.length },
    { id: "projects", label: "Projects", count: (data.projectsHistory || []).length },
    { id: "education", label: "Education", count: (data.educationHistory || []).length },
    { id: "certifications", label: "Certifications", count: (data.certificationsHistory || []).length },
    { id: "interview-prep", label: "Interview Prep", count: starStories.length },
    { id: "pdf", label: "Master CV PDF" },
  ];

  const showFilterBar = ["variants", "achievements", "skills", "experience", "projects"].includes(activeTab);

  return (
    <div className="ui-shell ui-controls flex-1 text-slate-100 font-sans selection:bg-blue-500/30 selection:text-white">
      <header className="border-b border-[var(--ui-border)] bg-[#0b1220]/95 backdrop-blur-md sm:sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              aria-label="Back to Dashboard"
              onClick={(event) => {
                if (isDirty && !window.confirm("You have unsaved changes in your Master CV. Leave without saving?")) event.preventDefault();
              }}
              className="ui-button ui-button--secondary p-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-white">Master CV</h1>
              <p className="text-xs text-slate-400">Your single source of truth for new applications and prompts</p>
              <p role="status" className={`text-xs mt-0.5 ${isDirty ? "text-amber-200" : "text-slate-300"}`}>
                {isDirty ? "Unsaved changes · Ctrl+S to save" : "Master CV saved"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (activeTab !== "pdf") setActiveTab("pdf");
                void handleExportMasterPdf();
              }}
              disabled={exportingPdf}
              className="ui-button ui-button--secondary"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              {exportingPdf ? "Generating PDF…" : "Export Master PDF"}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="ui-button ui-button--primary"
            >
              {saving ? (
                <><span aria-hidden="true" className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />Saving…</>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Master CV
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <p className="mb-4 rounded-xl border border-[var(--ui-border)] bg-[#10233f]/50 px-4 py-2.5 text-sm text-slate-200">
          Updates here power future prompts and new application drafts. Existing applications stay unchanged.
        </p>
        {(loadError || saveFailure) && (
          <div role="alert" className="mb-4 rounded-xl border border-amber-500/40 bg-amber-950/25 px-4 py-3 text-sm text-amber-100 space-y-2">
            <p>{loadError || saveFailure?.message}</p>
            <div className="flex flex-wrap gap-2">
              {saveFailure && saveFailure.kind !== "conflict" && (
                <button type="button" onClick={() => void handleSave()} className="ui-button ui-button--primary text-xs">
                  Retry Save
                </button>
              )}
              <button type="button" onClick={reloadProfile} className="ui-button ui-button--secondary text-xs">
                Reload Saved Profile
              </button>
            </div>
          </div>
        )}

        {/* Responsive Wrapping Navigation Tabs */}
        <div role="group" aria-label="Master CV sections" className="flex flex-wrap border-b border-[var(--ui-border)] mb-6 gap-1.5 pb-2.5">
          {tabsConfig.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={`ui-button text-xs sm:text-sm ${activeTab === tab.id ? "ui-button--secondary" : "ui-button--quiet"}`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span className="rounded-full bg-slate-800/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-300 tabular-nums">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {showFilterBar && (
          <div className="mb-5 relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              placeholder="Filter items in this tab…"
              aria-label="Filter items in this tab"
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs"
            />
            {sectionFilter && (
              <button
                type="button"
                onClick={() => setSectionFilter("")}
                aria-label="Clear filter"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Tab 1: General Info & Links */}
        {activeTab === "general" && (
          <div className="space-y-6 max-w-3xl">
            <div className="ui-panel p-5 sm:p-6 space-y-4">
              <h2 className="text-base font-bold text-white border-b border-[var(--ui-border)] pb-2">Personal Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="master-full-name" className="text-xs font-semibold text-slate-300 block mb-1">Full Name</label>
                  <input id="master-full-name" type="text" value={data.fullName} placeholder="e.g. Alex Morgan" onChange={(e) => updateGeneral("fullName", e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" />
                </div>
                <div>
                  <label htmlFor="master-location" className="text-xs font-semibold text-slate-300 block mb-1">Location</label>
                  <input id="master-location" type="text" value={data.location} placeholder="e.g. London, United Kingdom" onChange={(e) => updateGeneral("location", e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" />
                </div>
                <div>
                  <label htmlFor="master-email" className="text-xs font-semibold text-slate-300 block mb-1">Email</label>
                  <input id="master-email" type="email" value={data.email} placeholder="e.g. alex.morgan@example.com" onChange={(e) => updateGeneral("email", e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" />
                </div>
                <div>
                  <label htmlFor="master-phone" className="text-xs font-semibold text-slate-300 block mb-1">Phone</label>
                  <input id="master-phone" type="text" value={data.phone} placeholder="e.g. +44 20 7946 0192" onChange={(e) => updateGeneral("phone", e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" />
                </div>
                <div>
                  <label htmlFor="master-availability" className="text-xs font-semibold text-slate-300 block mb-1">Availability</label>
                  <input id="master-availability" type="text" value={data.availability} onChange={(e) => updateGeneral("availability", e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" placeholder="Leave blank = to be confirmed" />
                </div>
                <div>
                  <label htmlFor="master-work-auth" className="text-xs font-semibold text-slate-300 block mb-1">Work Authorization</label>
                  <input
                    id="master-work-auth"
                    type="text"
                    value={data.workAuthorization ?? data.workPermitGermany ?? ""}
                    onChange={(e) => updateWorkAuthorization(e.target.value)}
                    aria-describedby="master-work-auth-help"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    placeholder="e.g. Authorized to work in the UK / EU without sponsorship"
                  />
                  <p id="master-work-auth-help" className="mt-1 text-xs text-slate-400">
                    Copied to new drafts only if entered here; never inferred from your location.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--ui-border)]">
                <span className="text-xs font-semibold text-slate-300 block mb-2">Accepted Work Modes</span>
                <div className="flex flex-wrap gap-2">
                  {WORK_MODES_PRESETS.map((mode) => {
                    const selected = (data.workModes || []).includes(mode);
                    return (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleWorkMode(mode)}
                        className="ui-button ui-button--secondary text-xs"
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Links Block */}
            <div className="ui-panel p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-2">
                <h2 className="text-base font-bold text-white">Professional Links</h2>
                <button type="button" onClick={handleAddLink} className="ui-button ui-button--secondary text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Link
                </button>
              </div>
              {data.links.map((link, idx) => (
                <div key={idx} className="ui-inset flex flex-wrap gap-3 items-end p-3 rounded-lg">
                  <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="min-w-0">
                      <label htmlFor={`${fieldId}-field-6-${idx}`} className="mb-1 block text-xs text-slate-300">{`Link label ${idx + 1}`}</label>
                      <input id={`${fieldId}-field-6-${idx}`} type="text" placeholder="e.g. LinkedIn" value={link.label} onChange={(e) => handleLinkChange(idx, "label", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <label htmlFor={`${fieldId}-field-7-${idx}`} className="mb-1 block text-xs text-slate-300">{`Link URL ${idx + 1}`}</label>
                      <input id={`${fieldId}-field-7-${idx}`} type="url" placeholder="https://…" value={link.url} onChange={(e) => handleLinkChange(idx, "url", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                    </div>
                  </div>
                  <button aria-label={`Delete link ${idx + 1}`} type="button" onClick={() => handleRemoveLink(idx)} className="ui-button ui-button--danger-subtle p-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Languages Block */}
            <div className="ui-panel p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-2">
                <h2 className="text-base font-bold text-white">Languages</h2>
                <button type="button" onClick={handleAddLanguage} className="ui-button ui-button--secondary text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Language
                </button>
              </div>
              {(data.languages || []).map((lang, idx) => (
                <div key={idx} className="ui-inset flex flex-wrap gap-3 items-end p-3 rounded-lg">
                  <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <label htmlFor={`${fieldId}-field-8-${idx}`} className="mb-1 block text-xs text-slate-300">{`Language ${idx + 1}`}</label>
                      <input id={`${fieldId}-field-8-${idx}`} type="text" placeholder="e.g. German" value={lang.language} onChange={(e) => handleUpdateLanguage(idx, "language", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                    </div>
                    <div className="min-w-0">
                      <label htmlFor={`${fieldId}-field-9-${idx}`} className="mb-1 block text-xs text-slate-300">{`Proficiency ${idx + 1}`}</label>
                      <input id={`${fieldId}-field-9-${idx}`} type="text" placeholder="e.g. B2 / Professional" value={lang.level} onChange={(e) => handleUpdateLanguage(idx, "level", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                    </div>
                  </div>
                  <button aria-label={`Delete language ${idx + 1}`} type="button" onClick={() => handleRemoveLanguage(idx)} className="ui-button ui-button--danger-subtle p-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <SaveSectionButton section="profile details" saving={saving} dirty={isDirty} onSave={() => void handleSave()} />
          </div>
        )}

        {/* Tab 2: Headline & Profile Variants */}
        {activeTab === "variants" && (
          <div className="space-y-8 max-w-4xl">
            <div className="ui-panel p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-2">
                <div>
                  <h2 className="text-base font-bold text-white">Headline Variants</h2>
                  <p className="text-xs text-slate-400">Reference headlines tailored to different role families you target.</p>
                </div>
                <button type="button" onClick={handleAddHeadlineVariant} className="ui-button ui-button--secondary text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Headline
                </button>
              </div>
              <div className="space-y-4">
                {data.headlineVariants.map((item, idx) =>
                  matchesFilter(item.category, item.headline) ? (
                    <div key={idx} className="ui-inset space-y-2 p-4 rounded-xl">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <input
                          aria-label={`Headline category ${idx + 1}`}
                          type="text"
                          value={item.category}
                          placeholder="Category name"
                          onChange={(e) => handleHeadlineChange(idx, "category", e.target.value)}
                          className="min-w-0 flex-1 px-2.5 py-1 rounded text-xs font-bold text-blue-300"
                        />
                        <div className="flex items-center gap-1">
                          <button type="button" aria-label={`Move headline ${idx + 1} up`} disabled={idx === 0} onClick={() => handleMoveHeadlineVariant(idx, -1)} className="ui-button ui-button--quiet p-1"><ArrowUp className="w-3.5 h-3.5" /></button>
                          <button type="button" aria-label={`Move headline ${idx + 1} down`} disabled={idx === data.headlineVariants.length - 1} onClick={() => handleMoveHeadlineVariant(idx, 1)} className="ui-button ui-button--quiet p-1"><ArrowDown className="w-3.5 h-3.5" /></button>
                          <button type="button" aria-label={`Delete headline ${idx + 1}`} onClick={() => handleRemoveHeadlineVariant(idx)} className="ui-button ui-button--danger-subtle p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <input
                        aria-label={`Professional headline ${idx + 1}`}
                        id={`${fieldId}-field-10-${idx}`}
                        type="text"
                        value={item.headline}
                        placeholder="e.g. Senior Operations & Strategy Lead"
                        onChange={(e) => handleHeadlineChange(idx, "headline", e.target.value)}
                        className="w-full px-3 py-2 rounded text-xs font-mono"
                      />
                    </div>
                  ) : null
                )}
              </div>
            </div>

            <div className="ui-panel p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-2">
                <div>
                  <h2 className="text-base font-bold text-white">Professional Summary Variants</h2>
                  <p className="text-xs text-slate-400">Baseline summaries for different domains (recommended ≤ 65 words).</p>
                </div>
                <button type="button" onClick={handleAddProfileVariant} className="ui-button ui-button--secondary text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Summary
                </button>
              </div>
              <div className="space-y-4">
                {data.profileVariants.map((item, idx) => {
                  if (!matchesFilter(item.category, item.text)) return null;
                  const words = countWords(item.text);
                  return (
                    <div key={idx} className="ui-inset space-y-2 p-4 rounded-xl">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <input
                          aria-label={`Summary category ${idx + 1}`}
                          type="text"
                          value={item.category}
                          placeholder="Category name"
                          onChange={(e) => handleProfileVariantChange(idx, "category", e.target.value)}
                          className="min-w-0 flex-1 px-2.5 py-1 rounded text-xs font-bold text-blue-300"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] tabular-nums ${words > 65 ? "text-amber-300 font-semibold" : "text-slate-400"}`}>{words} words</span>
                          <button type="button" aria-label={`Move summary ${idx + 1} up`} disabled={idx === 0} onClick={() => handleMoveProfileVariant(idx, -1)} className="ui-button ui-button--quiet p-1"><ArrowUp className="w-3.5 h-3.5" /></button>
                          <button type="button" aria-label={`Move summary ${idx + 1} down`} disabled={idx === data.profileVariants.length - 1} onClick={() => handleMoveProfileVariant(idx, 1)} className="ui-button ui-button--quiet p-1"><ArrowDown className="w-3.5 h-3.5" /></button>
                          <button type="button" aria-label={`Delete summary ${idx + 1}`} onClick={() => handleRemoveProfileVariant(idx)} className="ui-button ui-button--danger-subtle p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <textarea
                        aria-label={`Professional summary ${idx + 1}`}
                        id={`${fieldId}-field-11-${idx}`}
                        rows={4}
                        value={item.text}
                        placeholder="Describe your positioning and strengths for this target area…"
                        onChange={(e) => handleProfileVariantChange(idx, "text", e.target.value)}
                        className="w-full px-3 py-2 rounded text-xs leading-relaxed"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <SaveSectionButton section="headlines & summaries" saving={saving} dirty={isDirty} onSave={() => void handleSave()} />
          </div>
        )}

        {/* Tab 3: Achievements Library */}
        {activeTab === "achievements" && (
          <div className="ui-panel p-5 sm:p-6 space-y-4 max-w-4xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-2">
              <div>
                <h2 className="text-base font-bold text-white">Key Achievements Pool</h2>
                <p className="text-xs text-slate-400">
                  Verified career milestones used by Prompt Studio and tailored CVs (recommended ≤ 28 words per bullet).
                </p>
              </div>
              <button type="button" onClick={handleAddAchievement} className="ui-button ui-button--secondary text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Achievement
              </button>
            </div>
            <div className="space-y-3">
              {data.achievementsPool.map((achievement, idx) => {
                if (!matchesFilter(achievement)) return null;
                const words = countWords(achievement);
                return (
                  <div key={idx} className="ui-inset flex flex-wrap gap-3 items-start p-3 rounded-lg">
                    <span className="text-xs font-semibold text-blue-300 pt-2 tabular-nums">#{idx + 1}</span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <textarea
                        aria-label={`Achievement ${idx + 1}`}
                        id={`${fieldId}-field-12-${idx}`}
                        rows={2}
                        value={achievement}
                        placeholder="e.g. Reduced onboarding cycle time by 35% across four regional teams..."
                        onChange={(e) => handleAchievementChange(idx, e.target.value)}
                        className="w-full px-3 py-1.5 rounded text-xs leading-relaxed"
                      />
                      <span className={`text-[11px] tabular-nums ${words > 28 ? "text-amber-300 font-medium" : "text-slate-400"}`}>{words} words</span>
                    </div>
                    <div className="flex items-center gap-1 pt-1">
                      <button type="button" aria-label={`Move achievement ${idx + 1} up`} disabled={idx === 0} onClick={() => handleMoveAchievement(idx, -1)} className="ui-button ui-button--quiet p-1"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button type="button" aria-label={`Move achievement ${idx + 1} down`} disabled={idx === data.achievementsPool.length - 1} onClick={() => handleMoveAchievement(idx, 1)} className="ui-button ui-button--quiet p-1"><ArrowDown className="w-3.5 h-3.5" /></button>
                      <button aria-label={`Delete achievement ${idx + 1}`} type="button" onClick={() => handleRemoveAchievement(idx)} className="ui-button ui-button--danger-subtle p-1.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <SaveSectionButton section="achievements pool" saving={saving} dirty={isDirty} onSave={() => void handleSave()} />
          </div>
        )}

        {/* Tab 4: Core Skills Pool */}
        {activeTab === "skills" && (
          <div className="ui-panel p-5 sm:p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-2">
              <div>
                <h2 className="text-base font-bold text-white">Core Skills Pool</h2>
                <p className="text-xs text-slate-400">Organize tools, methods, and domain skills (editorial CV target: up to 4 groups × 5–6 skills).</p>
              </div>
              <button type="button" onClick={handleAddSkillGroup} className="ui-button ui-button--secondary text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Group
              </button>
            </div>
            <div className="space-y-5">
              {data.skillsPool.map((group, gIdx) => {
                if (!matchesFilter(group.group, ...group.skills)) return null;
                return (
                  <div key={gIdx} className="ui-inset p-4 sm:p-5 rounded-2xl space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-2.5">
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`${fieldId}-field-13-${gIdx}`} className="mb-1 block text-xs text-slate-400">
                          {`Group ${gIdx + 1} (${group.skills.length} skills)`}
                        </label>
                        <input
                          aria-label={`Skill group name ${gIdx + 1}`}
                          id={`${fieldId}-field-13-${gIdx}`}
                          type="text"
                          value={group.group}
                          placeholder="e.g. Analytics & Reporting"
                          onChange={(e) => handleSkillGroupTitleChange(gIdx, e.target.value)}
                          className="w-full min-w-0 font-bold text-white text-sm px-2.5 py-1.5 rounded"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label={`Move group ${gIdx + 1} up`} disabled={gIdx === 0} onClick={() => handleMoveSkillGroup(gIdx, -1)} className="ui-button ui-button--quiet p-1.5"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <button type="button" aria-label={`Move group ${gIdx + 1} down`} disabled={gIdx === data.skillsPool.length - 1} onClick={() => handleMoveSkillGroup(gIdx, 1)} className="ui-button ui-button--quiet p-1.5"><ArrowDown className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => handleRemoveSkillGroup(gIdx)} className="ui-button ui-button--danger-subtle text-xs">
                          <Trash2 className="w-3.5 h-3.5" /> Delete Group
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      {group.skills.map((skill, sIdx) => (
                        <div key={sIdx} className="ui-panel flex items-center px-2.5 py-1 rounded-lg gap-1.5 text-xs text-slate-200 max-w-full">
                          <input
                            aria-label={`Skill ${sIdx + 1} in group ${gIdx + 1}`}
                            id={`${fieldId}-field-14-${gIdx}-${sIdx}`}
                            type="text"
                            value={skill}
                            placeholder="Skill…"
                            onChange={(e) => handleSkillNameChange(gIdx, sIdx, e.target.value)}
                            style={{ width: `${Math.min(Math.max(skill.length + 3, 12), 42)}ch` }}
                            className="bg-transparent border-0 px-1 py-0.5 text-xs max-w-full min-h-0"
                          />
                          <button
                            aria-label={`Delete skill ${sIdx + 1}`}
                            type="button"
                            onClick={() => handleRemoveSkillFromGroup(gIdx, sIdx)}
                            className="ui-button ui-button--danger-subtle px-1.5 py-0.5 min-h-0"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => handleAddSkillToGroup(gIdx)} className="ui-button ui-button--secondary text-xs">
                        + Add Skill
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <SaveSectionButton section="skills pool" saving={saving} dirty={isDirty} onSave={() => void handleSave()} />
          </div>
        )}

        {/* Tab 5: Experience Details */}
        {activeTab === "experience" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <h2 className="text-base font-bold text-white">Work Experience</h2>
              <button type="button" onClick={handleAddExperience} className="ui-button ui-button--secondary text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Experience
              </button>
            </div>
            {data.experienceHistory.map((exp, expIdx) => {
              if (!matchesFilter(exp.jobTitle, exp.company, exp.summary, ...exp.bullets)) return null;
              return (
                <div key={exp.id || expIdx} className="ui-panel p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-2.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--ui-inset)] text-blue-300 border border-[var(--ui-border)]">
                        ID: {exp.id}
                      </span>
                      <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exp.include !== false}
                          onChange={(e) => handleUpdateExperience(expIdx, "include", e.target.checked)}
                          className="rounded border-slate-600"
                        />
                        Include by default in new applications
                      </label>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label={`Move experience ${expIdx + 1} up`} disabled={expIdx === 0} onClick={() => handleMoveExperience(expIdx, -1)} className="ui-button ui-button--quiet p-1.5"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button type="button" aria-label={`Move experience ${expIdx + 1} down`} disabled={expIdx === data.experienceHistory.length - 1} onClick={() => handleMoveExperience(expIdx, 1)} className="ui-button ui-button--quiet p-1.5"><ArrowDown className="w-3.5 h-3.5" /></button>
                      <button type="button" aria-label={`Delete experience ${expIdx + 1}`} onClick={() => handleRemoveExperience(expIdx)} className="ui-button ui-button--danger-subtle text-xs">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label htmlFor={`${fieldId}-field-15-${expIdx}`} className="text-xs font-bold text-blue-300 block mb-1">Job Title</label>
                      <input id={`${fieldId}-field-15-${expIdx}`} type="text" value={exp.jobTitle} placeholder="e.g. Senior Product Manager" onChange={(e) => handleUpdateExperience(expIdx, "jobTitle", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs font-semibold" />
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-field-16-${expIdx}`} className="text-xs font-bold text-blue-300 block mb-1">Company</label>
                      <input id={`${fieldId}-field-16-${expIdx}`} type="text" value={exp.company} placeholder="e.g. Acme Corp" onChange={(e) => handleUpdateExperience(expIdx, "company", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs font-semibold" />
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-field-17-${expIdx}`} className="text-xs font-bold text-blue-300 block mb-1">Dates</label>
                      <input id={`${fieldId}-field-17-${expIdx}`} type="text" value={exp.dates} placeholder="e.g. Jan 2023 – Present" onChange={(e) => handleUpdateExperience(expIdx, "dates", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-field-18-${expIdx}`} className="text-xs font-bold text-blue-300 block mb-1">Location</label>
                      <input id={`${fieldId}-field-18-${expIdx}`} type="text" value={exp.location} placeholder="e.g. London, UK" onChange={(e) => handleUpdateExperience(expIdx, "location", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor={`${fieldId}-field-19-${expIdx}`} className="text-xs font-bold text-blue-300 block mb-1">Role Summary</label>
                    <input id={`${fieldId}-field-19-${expIdx}`} type="text" value={exp.summary || ""} placeholder="Brief scope and context for this role…" onChange={(e) => handleUpdateExperience(expIdx, "summary", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-1.5">
                      <span className="text-xs font-bold text-slate-300">Experience Bullets</span>
                      <button type="button" onClick={() => handleAddExperienceBullet(expIdx)} className="ui-button ui-button--secondary text-xs">
                        + Add Bullet
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {exp.bullets.map((bullet, bIdx) => {
                        const words = countWords(bullet);
                        return (
                          <div key={bIdx} className="ui-inset flex flex-wrap gap-2 items-start p-2.5 rounded-lg">
                            <span className="text-xs text-blue-300 pt-1.5">•</span>
                            <div className="min-w-0 flex-1 space-y-1">
                              <textarea
                                aria-label={`Bullet ${bIdx + 1} for experience ${expIdx + 1}`}
                                id={`${fieldId}-field-20-${expIdx}-${bIdx}`}
                                rows={2}
                                value={bullet}
                                placeholder="Quantifiable achievement or responsibility…"
                                onChange={(e) => handleExperienceBulletChange(expIdx, bIdx, e.target.value)}
                                className="w-full p-1.5 rounded text-xs leading-relaxed"
                              />
                              <span className={`text-[11px] tabular-nums ${words > 28 ? "text-amber-300" : "text-slate-400"}`}>{words} words</span>
                            </div>
                            <div className="flex items-center gap-0.5 pt-1">
                              <button type="button" aria-label={`Move bullet ${bIdx + 1} up`} disabled={bIdx === 0} onClick={() => handleMoveExperienceBullet(expIdx, bIdx, -1)} className="ui-button ui-button--quiet p-1"><ArrowUp className="w-3.5 h-3.5" /></button>
                              <button type="button" aria-label={`Move bullet ${bIdx + 1} down`} disabled={bIdx === exp.bullets.length - 1} onClick={() => handleMoveExperienceBullet(expIdx, bIdx, 1)} className="ui-button ui-button--quiet p-1"><ArrowDown className="w-3.5 h-3.5" /></button>
                              <button aria-label={`Delete bullet ${bIdx + 1} for experience ${expIdx + 1}`} type="button" onClick={() => handleRemoveExperienceBullet(expIdx, bIdx)} className="ui-button ui-button--danger-subtle p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Editable Deep Duty Pillars */}
                  <details className="mt-3 pt-2 border-t border-[var(--ui-border)]">
                    <summary className="text-xs font-bold text-emerald-300 cursor-pointer select-none">
                      Deep Duty Pillars ({(exp.pillars || []).length} responsibility groups)
                    </summary>
                    <div className="mt-3 space-y-3">
                      {(exp.pillars || []).map((pillar, pIdx) => (
                        <div key={pillar.id} className="ui-inset rounded-lg p-3 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <input
                              type="text"
                              aria-label={`Pillar title ${pIdx + 1}`}
                              value={pillar.title}
                              placeholder="Pillar title (e.g. Process & Operations)"
                              onChange={(e) => handleUpdatePillarTitle(expIdx, pIdx, e.target.value)}
                              className="min-w-0 flex-1 px-2.5 py-1 rounded text-xs font-bold text-white"
                            />
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => handleAddPillarDuty(expIdx, pIdx)} className="ui-button ui-button--secondary text-xs">+ Duty</button>
                              <button type="button" aria-label={`Delete pillar ${pIdx + 1}`} onClick={() => handleRemovePillar(expIdx, pIdx)} className="ui-button ui-button--danger-subtle p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {pillar.duties.map((duty, dIdx) => (
                              <div key={dIdx} className="flex items-start gap-2">
                                <textarea
                                  rows={2}
                                  aria-label={`Duty ${dIdx + 1} in pillar ${pIdx + 1}`}
                                  value={duty}
                                  placeholder="Reference responsibility or verified scope…"
                                  onChange={(e) => handleUpdatePillarDuty(expIdx, pIdx, dIdx, e.target.value)}
                                  className="min-w-0 flex-1 px-2.5 py-1 rounded text-xs"
                                />
                                <button type="button" aria-label={`Delete duty ${dIdx + 1}`} onClick={() => handleRemovePillarDuty(expIdx, pIdx, dIdx)} className="ui-button ui-button--danger-subtle p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => handleAddExperiencePillar(expIdx)} className="ui-button ui-button--secondary text-xs">
                        + Add Duty Pillar
                      </button>
                    </div>
                  </details>
                </div>
              );
            })}
            <SaveSectionButton section="experience" saving={saving} dirty={isDirty} onSave={() => void handleSave()} />
          </div>
        )}

        {/* Tab 6: Projects Details */}
        {activeTab === "projects" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <h2 className="text-base font-bold text-white">Projects</h2>
              <button type="button" onClick={handleAddProject} className="ui-button ui-button--secondary text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Project
              </button>
            </div>
            {(data.projectsHistory || []).map((proj, projIdx) => {
              if (!matchesFilter(proj.title, proj.role, proj.description, ...(proj.bullets || []))) return null;
              return (
                <div key={proj.id || projIdx} className="ui-panel p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-2.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--ui-inset)] text-blue-300 border border-[var(--ui-border)]">
                        ID: {proj.id}
                      </span>
                      <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={proj.include !== false}
                          onChange={(e) => handleUpdateProject(projIdx, "include", e.target.checked)}
                          className="rounded border-slate-600"
                        />
                        Include by default in new applications
                      </label>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label={`Move project ${projIdx + 1} up`} disabled={projIdx === 0} onClick={() => handleMoveProject(projIdx, -1)} className="ui-button ui-button--quiet p-1.5"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button type="button" aria-label={`Move project ${projIdx + 1} down`} disabled={projIdx === (data.projectsHistory || []).length - 1} onClick={() => handleMoveProject(projIdx, 1)} className="ui-button ui-button--quiet p-1.5"><ArrowDown className="w-3.5 h-3.5" /></button>
                      <button type="button" aria-label={`Delete project ${projIdx + 1}`} onClick={() => handleRemoveProject(projIdx)} className="ui-button ui-button--danger-subtle text-xs">
                        <Trash2 className="w-3.5 h-3.5" /> Delete Project
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor={`${fieldId}-field-21-${projIdx}`} className="text-xs font-bold text-blue-300 block mb-1">Project Name</label>
                      <input id={`${fieldId}-field-21-${projIdx}`} type="text" value={proj.title} placeholder="e.g. Internal Analytics Dashboard" onChange={(e) => handleUpdateProject(projIdx, "title", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs font-semibold" />
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-field-22-${projIdx}`} className="text-xs font-bold text-blue-300 block mb-1">Role</label>
                      <input id={`${fieldId}-field-22-${projIdx}`} type="text" value={proj.role} placeholder="e.g. Lead Builder" onChange={(e) => handleUpdateProject(projIdx, "role", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs font-semibold" />
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-field-23-${projIdx}`} className="text-xs font-bold text-blue-300 block mb-1">Dates</label>
                      <input id={`${fieldId}-field-23-${projIdx}`} type="text" value={proj.dates} placeholder="e.g. 2025" onChange={(e) => handleUpdateProject(projIdx, "dates", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor={`${fieldId}-proj-desc-${projIdx}`} className="text-xs font-bold text-blue-300 block mb-1">Short Description</label>
                      <input id={`${fieldId}-proj-desc-${projIdx}`} type="text" value={proj.description} placeholder="Concise overview of what you built…" onChange={(e) => handleUpdateProject(projIdx, "description", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-proj-stack-${projIdx}`} className="text-xs font-bold text-blue-300 block mb-1">Tech Stack / Tools (comma-separated)</label>
                      <input
                        id={`${fieldId}-proj-stack-${projIdx}`}
                        type="text"
                        value={(proj.techStack || []).join(", ")}
                        placeholder="e.g. TypeScript, PostgreSQL, REST APIs"
                        onChange={(e) => handleUpdateProject(projIdx, "techStack", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                        className="w-full px-3 py-1.5 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-proj-repo-${projIdx}`} className="text-xs font-bold text-blue-300 block mb-1">Repository / Project URL</label>
                      <input id={`${fieldId}-proj-repo-${projIdx}`} type="url" value={proj.repoUrl || proj.url || ""} placeholder="https://github.com/..." onChange={(e) => handleUpdateProject(projIdx, "repoUrl", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-proj-demo-${projIdx}`} className="text-xs font-bold text-blue-300 block mb-1">Demo URL (optional)</label>
                      <input id={`${fieldId}-proj-demo-${projIdx}`} type="url" value={proj.demoUrl || ""} placeholder="https://..." onChange={(e) => handleUpdateProject(projIdx, "demoUrl", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-1.5">
                      <span className="text-xs font-bold text-slate-300">Project Bullets</span>
                      <button type="button" onClick={() => handleAddProjectBullet(projIdx)} className="ui-button ui-button--secondary text-xs">
                        + Add Bullet
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {(proj.bullets || []).map((bullet, bIdx) => (
                        <div key={bIdx} className="ui-inset flex flex-wrap gap-2 items-start p-2.5 rounded-lg">
                          <span className="text-xs text-blue-300 pt-1.5">•</span>
                          <textarea
                            aria-label={`Bullet ${bIdx + 1} for project ${projIdx + 1}`}
                            id={`${fieldId}-field-25-${projIdx}-${bIdx}`}
                            rows={2}
                            value={bullet}
                            placeholder="Outcome, scope, or technical architecture…"
                            onChange={(e) => handleProjectBulletChange(projIdx, bIdx, e.target.value)}
                            className="min-w-0 flex-1 p-1.5 rounded text-xs leading-relaxed"
                          />
                          <div className="flex items-center gap-0.5 pt-1">
                            <button type="button" aria-label={`Move bullet ${bIdx + 1} up`} disabled={bIdx === 0} onClick={() => handleMoveProjectBullet(projIdx, bIdx, -1)} className="ui-button ui-button--quiet p-1"><ArrowUp className="w-3.5 h-3.5" /></button>
                            <button type="button" aria-label={`Move bullet ${bIdx + 1} down`} disabled={bIdx === (proj.bullets || []).length - 1} onClick={() => handleMoveProjectBullet(projIdx, bIdx, 1)} className="ui-button ui-button--quiet p-1"><ArrowDown className="w-3.5 h-3.5" /></button>
                            <button aria-label={`Delete bullet ${bIdx + 1} for project ${projIdx + 1}`} type="button" onClick={() => handleRemoveProjectBullet(projIdx, bIdx)} className="ui-button ui-button--danger-subtle p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            <SaveSectionButton section="projects" saving={saving} dirty={isDirty} onSave={() => void handleSave()} />
          </div>
        )}

        {/* Tab 7: Education Details */}
        {activeTab === "education" && (
          <div className="space-y-6 max-w-4xl">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div>
                <h2 className="text-base font-bold text-white">Education &amp; Training</h2>
                <p className="text-xs text-slate-400">Degrees, diplomas, and formal training referenced by prompts and drafts.</p>
              </div>
              <button type="button" onClick={handleAddEducation} className="ui-button ui-button--secondary text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Education
              </button>
            </div>
            {(data.educationHistory || []).map((edu, idx) => (
              <div key={edu.id || idx} className="ui-panel p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--ui-inset)] text-blue-300 border border-[var(--ui-border)]">
                    ID: {edu.id}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label={`Move education ${idx + 1} up`} disabled={idx === 0} onClick={() => handleMoveEducation(idx, -1)} className="ui-button ui-button--quiet p-1"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" aria-label={`Move education ${idx + 1} down`} disabled={idx === (data.educationHistory || []).length - 1} onClick={() => handleMoveEducation(idx, 1)} className="ui-button ui-button--quiet p-1"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button type="button" aria-label={`Delete education ${idx + 1}`} onClick={() => handleRemoveEducation(idx)} className="ui-button ui-button--danger-subtle text-xs">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label htmlFor={`${fieldId}-field-26-${idx}`} className="text-xs font-bold text-blue-300 block mb-1">Degree or Program</label>
                    <input id={`${fieldId}-field-26-${idx}`} type="text" value={edu.degree} placeholder="e.g. B.Sc. in Business Administration" onChange={(e) => handleUpdateEducation(idx, "degree", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs font-semibold" />
                  </div>
                  <div>
                    <label htmlFor={`${fieldId}-field-27-${idx}`} className="text-xs font-bold text-blue-300 block mb-1">Period</label>
                    <input id={`${fieldId}-field-27-${idx}`} type="text" value={edu.period} placeholder="e.g. 2018 – 2022" onChange={(e) => handleUpdateEducation(idx, "period", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                  </div>
                </div>
                <div>
                  <label htmlFor={`${fieldId}-field-28-${idx}`} className="text-xs font-bold text-blue-300 block mb-1">Institution</label>
                  <input id={`${fieldId}-field-28-${idx}`} type="text" value={edu.institution} placeholder="e.g. University Name, City" onChange={(e) => handleUpdateEducation(idx, "institution", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                </div>
                <div>
                  <label htmlFor={`${fieldId}-field-29-${idx}`} className="text-xs font-bold text-blue-300 block mb-1">Focus / Description</label>
                  <textarea id={`${fieldId}-field-29-${idx}`} rows={3} value={edu.description || ""} placeholder="Relevant coursework, honors, or concentration…" onChange={(e) => handleUpdateEducation(idx, "description", e.target.value)} className="w-full px-3 py-2 rounded text-xs leading-relaxed" />
                </div>
              </div>
            ))}
            <SaveSectionButton section="education" saving={saving} dirty={isDirty} onSave={() => void handleSave()} />
          </div>
        )}

        {/* Tab 8: Certifications & Applied Methodologies */}
        {activeTab === "certifications" && (
          <div className="ui-panel p-5 sm:p-6 space-y-5 max-w-4xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-2">
              <div>
                <h2 className="text-base font-bold text-white">Certifications</h2>
                <p className="text-xs text-slate-400">Keep official credential titles, issuing bodies, dates, and IDs accurate.</p>
              </div>
              <button type="button" onClick={handleAddCertification} className="ui-button ui-button--secondary text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Certification
              </button>
            </div>
            <div className="space-y-3">
              {(data.certificationsHistory || []).map((cert, idx) => (
                <div key={cert.id || idx} className="ui-inset p-4 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--ui-panel)] text-blue-300 border border-[var(--ui-border)]">
                      ID: {cert.id}
                    </span>
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label={`Move certification ${idx + 1} up`} disabled={idx === 0} onClick={() => handleMoveCertification(idx, -1)} className="ui-button ui-button--quiet p-1"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button type="button" aria-label={`Move certification ${idx + 1} down`} disabled={idx === (data.certificationsHistory || []).length - 1} onClick={() => handleMoveCertification(idx, 1)} className="ui-button ui-button--quiet p-1"><ArrowDown className="w-3.5 h-3.5" /></button>
                      <button aria-label={`Delete certification ${idx + 1}`} type="button" onClick={() => handleRemoveCertification(idx)} className="ui-button ui-button--danger-subtle p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <label htmlFor={`${fieldId}-field-30-${idx}`} className="text-xs font-bold text-blue-300 block mb-1">Certification Name</label>
                      <input id={`${fieldId}-field-30-${idx}`} type="text" value={cert.name} placeholder="Official certification title" onChange={(e) => handleUpdateCertification(idx, "name", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-field-31-${idx}`} className="text-xs font-bold text-blue-300 block mb-1">Issuing Authority (optional)</label>
                      <input id={`${fieldId}-field-31-${idx}`} type="text" value={cert.authority || ""} placeholder="e.g. PMI, AWS" onChange={(e) => handleUpdateCertification(idx, "authority", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-field-32-${idx}`} className="text-xs font-bold text-blue-300 block mb-1">Date (optional)</label>
                      <input id={`${fieldId}-field-32-${idx}`} type="text" value={cert.date || ""} placeholder="e.g. May 2024" onChange={(e) => handleUpdateCertification(idx, "date", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`${fieldId}-field-33-${idx}`} className="text-xs font-bold text-blue-300 block mb-1">Credential ID (optional)</label>
                      <input id={`${fieldId}-field-33-${idx}`} type="text" value={cert.credentialId || ""} onChange={(e) => handleUpdateCertification(idx, "credentialId", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-field-34-${idx}`} className="text-xs font-bold text-blue-300 block mb-1">Expiry / Validity (optional)</label>
                      <input id={`${fieldId}-field-34-${idx}`} type="text" value={cert.expiryDate || ""} onChange={(e) => handleUpdateCertification(idx, "expiryDate", e.target.value)} className="w-full px-3 py-1.5 rounded text-xs" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--ui-border)] pt-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">Applied Methodologies &amp; Competencies (Unaccredited)</h3>
                  <p className="text-xs text-slate-400">
                    Transparent list of applied frameworks and domain knowledge (e.g. Agile/Scrum, Lean Six Sigma, ISO 27001) shown as competencies rather than formal certifications.
                  </p>
                </div>
                <button type="button" onClick={handleAddSpecializedCompetency} className="ui-button ui-button--secondary text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Competency
                </button>
              </div>
              <div className="space-y-2">
                {(data.specializedCompetencies || []).map((item, idx) => (
                  <div key={idx} className="ui-inset flex gap-2 items-center p-2.5 rounded-lg">
                    <label htmlFor={`${fieldId}-spec-${idx}`} className="sr-only">{`Applied methodology ${idx + 1}`}</label>
                    <input
                      id={`${fieldId}-spec-${idx}`}
                      aria-label={`Applied methodology ${idx + 1}`}
                      type="text"
                      value={item}
                      onChange={(e) => handleUpdateSpecializedCompetency(idx, e.target.value)}
                      className="min-w-0 flex-1 px-3 py-1.5 rounded text-xs"
                      placeholder="e.g. Lean Six Sigma — Applied process improvement methodology"
                    />
                    <button aria-label={`Delete applied methodology ${idx + 1}`} type="button" onClick={() => handleRemoveSpecializedCompetency(idx)} className="ui-button ui-button--danger-subtle p-1.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <SaveSectionButton section="certifications" saving={saving} dirty={isDirty} onSave={() => void handleSave()} />
          </div>
        )}

        {/* Tab 9: Interview Prep Repository */}
        {activeTab === "interview-prep" && (
          <div className="space-y-6 max-w-4xl">
            <div className="ui-panel p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-white border-b border-[var(--ui-border)] pb-2">Career Narrative Summary</h2>
                <p className="text-xs text-slate-400 mt-1.5">
                  Your baseline 60-second career arc reused when generating STAR interview prep dossiers.
                </p>
              </div>
              <textarea
                aria-label="Career narrative summary"
                rows={4}
                value={interviewPrep.careerArcSummary || ""}
                placeholder="Summarize your career trajectory, key transitions, and core value proposition…"
                onChange={(e) => updateInterviewPrep((cur) => ({ ...cur, careerArcSummary: e.target.value }))}
                className="w-full px-3 py-2 rounded text-xs leading-relaxed"
              />
            </div>

            <div className="ui-panel p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-2">
                <div>
                  <h2 className="text-base font-bold text-white">Reusable STAR Stories</h2>
                  <p className="text-xs text-slate-400">Verified Situation–Task–Action–Result stories grounded in your work history.</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateInterviewPrep((cur) => ({
                      ...cur,
                      starStories: [
                        ...(cur.starStories || []),
                        { title: "", situation: "", task: "", action: "", result: "", keywords: [] },
                      ],
                    }))
                  }
                  className="ui-button ui-button--secondary text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add STAR Story
                </button>
              </div>
              <div className="space-y-4">
                {starStories.map((story, idx) => (
                  <div key={idx} className="ui-inset p-4 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <input
                        aria-label={`STAR story title ${idx + 1}`}
                        type="text"
                        value={story.title}
                        placeholder="e.g. Regional Intake & Routing Redesign (-34% Resolution Time)"
                        onChange={(e) =>
                          updateInterviewPrep((cur) => ({
                            ...cur,
                            starStories: (cur.starStories || []).map((s, i) => (i === idx ? { ...s, title: e.target.value } : s)),
                          }))
                        }
                        className="min-w-0 flex-1 px-2.5 py-1.5 rounded text-xs font-bold text-white"
                      />
                      <button
                        type="button"
                        aria-label={`Delete STAR story ${idx + 1}`}
                        onClick={() =>
                          updateInterviewPrep((cur) => ({
                            ...cur,
                            starStories: (cur.starStories || []).filter((_, i) => i !== idx),
                          }))
                        }
                        className="ui-button ui-button--danger-subtle p-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(["situation", "task", "action", "result"] as const).map((part) => (
                        <div key={part}>
                          <label htmlFor={`${fieldId}-star-${idx}-${part}`} className="text-xs font-bold text-blue-300 capitalize block mb-1">
                            {part}
                          </label>
                          <textarea
                            id={`${fieldId}-star-${idx}-${part}`}
                            rows={2}
                            value={story[part]}
                            placeholder={`Describe the ${part}…`}
                            onChange={(e) =>
                              updateInterviewPrep((cur) => ({
                                ...cur,
                                starStories: (cur.starStories || []).map((s, i) => (i === idx ? { ...s, [part]: e.target.value } : s)),
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded text-xs leading-relaxed"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="ui-panel p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--ui-border)] pb-2">
                  <h3 className="text-sm font-bold text-white">Questions to Ask Interviewers</h3>
                  <button
                    type="button"
                    onClick={() =>
                      updateInterviewPrep((cur) => ({ ...cur, questionsToAsk: [...(cur.questionsToAsk || []), ""] }))
                    }
                    className="ui-button ui-button--secondary text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {questionsToAsk.map((q, idx) => (
                    <div key={idx} className="ui-inset flex items-start gap-2 p-2 rounded-lg">
                      <textarea
                        rows={2}
                        aria-label={`Interviewer question ${idx + 1}`}
                        value={q}
                        placeholder="e.g. Which priorities define success in the first 90 days?"
                        onChange={(e) =>
                          updateInterviewPrep((cur) => ({
                            ...cur,
                            questionsToAsk: (cur.questionsToAsk || []).map((item, i) => (i === idx ? e.target.value : item)),
                          }))
                        }
                        className="min-w-0 flex-1 px-2 py-1 rounded text-xs"
                      />
                      <button
                        type="button"
                        aria-label={`Delete question ${idx + 1}`}
                        onClick={() =>
                          updateInterviewPrep((cur) => ({
                            ...cur,
                            questionsToAsk: (cur.questionsToAsk || []).filter((_, i) => i !== idx),
                          }))
                        }
                        className="ui-button ui-button--danger-subtle p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ui-panel p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--ui-border)] pb-2">
                  <h3 className="text-sm font-bold text-white">Quick Call Reference Notes</h3>
                  <button
                    type="button"
                    onClick={() =>
                      updateInterviewPrep((cur) => ({ ...cur, callSurvivalNotes: [...(cur.callSurvivalNotes || []), ""] }))
                    }
                    className="ui-button ui-button--secondary text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {callSurvivalNotes.map((note, idx) => (
                    <div key={idx} className="ui-inset flex items-start gap-2 p-2 rounded-lg">
                      <textarea
                        rows={2}
                        aria-label={`Call reference note ${idx + 1}`}
                        value={note}
                        placeholder="e.g. Notice period, salary anchors, work authorization reminder…"
                        onChange={(e) =>
                          updateInterviewPrep((cur) => ({
                            ...cur,
                            callSurvivalNotes: (cur.callSurvivalNotes || []).map((item, i) => (i === idx ? e.target.value : item)),
                          }))
                        }
                        className="min-w-0 flex-1 px-2 py-1 rounded text-xs"
                      />
                      <button
                        type="button"
                        aria-label={`Delete note ${idx + 1}`}
                        onClick={() =>
                          updateInterviewPrep((cur) => ({
                            ...cur,
                            callSurvivalNotes: (cur.callSurvivalNotes || []).filter((_, i) => i !== idx),
                          }))
                        }
                        className="ui-button ui-button--danger-subtle p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <SaveSectionButton section="interview prep" saving={saving} dirty={isDirty} onSave={() => void handleSave()} />
          </div>
        )}

        {activeTab === "pdf" && deferredMasterDocApp && (
          <MasterCvPdfPanel
            masterCv={data}
            masterApp={deferredMasterDocApp}
            options={pdfOptions}
            setOptions={setPdfOptions}
            exporting={exportingPdf}
            onExportPdf={() => void handleExportMasterPdf()}
            pageResult={pdfPageResult}
            onPagesMeasured={setPdfPageResult}
            onNotify={showToast}
          />
        )}
      </div>

      {masterDocApp && (
        <div aria-hidden="true" style={{ position: "fixed", left: -10000, top: 0, width: "210mm", pointerEvents: "none" }}>
          {masterDocApp.templateSettings.cvTemplate === "modern-professional"
            ? <ModernProfessionalCv data={masterDocApp} />
            : masterDocApp.templateSettings.cvTemplate === "dach-tabular"
            ? <DachTabularCv data={masterDocApp} />
            : <AtsCleanCv data={masterDocApp} />}
        </div>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
