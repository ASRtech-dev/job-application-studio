"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Briefcase, FileText, Trash2, Edit3, Image as ImageIcon, CheckCircle, Download, FileUp, Sparkles, Search, X, SlidersHorizontal, ChevronDown, ShieldCheck, HardDriveDownload, RefreshCw } from "lucide-react";
import { celebrate as confetti } from "../lib/celebration";
import SignaturePad from "../components/SignaturePad";
import PromptGeneratorModal, { PENDING_JD_STORAGE_KEY } from "../components/PromptGeneratorModal";
import { validateImportText } from "../lib/importPreview";
import { normalizeImportedAIJson } from "../lib/aiJsonMapper";
import { ImportPreviewPanel } from "../components/ImportPreviewPanel";
import { useDialogFocus } from "../lib/useDialogFocus";
import { MasterCvSchema, type Application, type ApplicationSummary } from "../lib/schemas";
import { computeDashboardFunnelAnalytics, computeDashboardViewIds, filterAndSortApplications, parseSavedDashboardFilters, DASHBOARD_FILTERS_KEY, type DashboardSortBy, type DashboardView } from "../lib/dashboardFilters";
import { getCrmOperationalViews, type CrmViewData } from "../lib/crmView";
import { useToast, ToastContainer } from "../components/Toast";
import { readPendingGeneration, resolvePromptContext, PENDING_GENERATION_KEY } from "../lib/generationContext";
import { CrmDashboard } from "../components/crm/CrmDashboard";
import { CrmActionDialog } from "../components/crm/CrmActionDialog";
import type { CrmContact, CrmDeliveryOption } from "../lib/crmSchemas";
import { deliveriesToOptions } from "../lib/deliveryOptions";
import { findDuplicateOffers, listPreparations, OfferPreparationSchema, savePreparation, type OfferPreparation } from "../lib/offerPreparations";
import { formatLocalDateTime, getAppTimeZone } from "../lib/timeZone";

interface MasterCvSummary {
  fullName: string;
  location: string;
  email: string;
  languages: { language: string; level: string }[];
}

const ROLE_TYPE_LABELS: Record<string, { label: string; style: string }> = {
  coreTarget: { label: "Core Target", style: "bg-slate-800/50 text-slate-300 border-slate-600" },
  bridgeRole: { label: "Bridge Role", style: "bg-slate-800/50 text-slate-300 border-slate-600" },
  stretchRole: { label: "Stretch Role", style: "bg-slate-800/50 text-slate-300 border-slate-600" },
  stabilityRole: { label: "Stability Role", style: "bg-slate-800/50 text-slate-300 border-slate-600" },
  alternativeRole: { label: "Alternative Role", style: "bg-slate-800/50 text-slate-300 border-slate-600" },
};

export default function Dashboard() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [roleTypeFilter, setRoleTypeFilter] = useState<string>("all");
  const [fitDecisionFilter, setFitDecisionFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<DashboardSortBy>("dateModified");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  // Read-only CRM views and persisted filters (restored after mount from browser storage).
  const [dashboardView, setDashboardView] = useState<DashboardView>("all");
  const [crmViewIds, setCrmViewIds] = useState<ReadonlySet<string> | null>(null);
  const [filtersRestored, setFiltersRestored] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let saved = parseSavedDashboardFilters(null);
      try { saved = parseSavedDashboardFilters(localStorage.getItem(DASHBOARD_FILTERS_KEY)); } catch { /* defaults */ }
      setDashboardView(saved.view); setSearchQuery(saved.searchQuery); setStatusFilter(saved.statusFilter);
      setLanguageFilter(saved.languageFilter); setRoleTypeFilter(saved.roleTypeFilter); setFitDecisionFilter(saved.fitDecisionFilter); setSortBy(saved.sortBy);
      setFiltersRestored(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!filtersRestored) return;
    try { localStorage.setItem(DASHBOARD_FILTERS_KEY, JSON.stringify({ view: dashboardView, searchQuery, statusFilter, languageFilter, roleTypeFilter, fitDecisionFilter, sortBy })); } catch { /* optional */ }
  }, [filtersRestored, dashboardView, searchQuery, statusFilter, languageFilter, roleTypeFilter, fitDecisionFilter, sortBy]);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [masterCv, setMasterCv] = useState<MasterCvSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [masterLoadError, setMasterLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // New App Form State
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [crmApplicationId, setCrmApplicationId] = useState<string | null>(null);
  // Frozen exports of the application whose activity dialog is open. Unknown until loaded.
  const [crmDeliveries, setCrmDeliveries] = useState<{ applicationId: string; options: CrmDeliveryOption[] } | null>(null);
  useEffect(() => {
    if (!crmApplicationId) return;
    const controller = new AbortController();
    fetch(`/api/applications/${encodeURIComponent(crmApplicationId)}/deliveries`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((records) => { if (!controller.signal.aborted) setCrmDeliveries({ applicationId: crmApplicationId, options: deliveriesToOptions(records) }); })
      .catch(() => { /* Without the list, sent documents simply stay unknown. */ });
    return () => controller.abort();
  }, [crmApplicationId]);
  const applicationsKey = applications.map((application) => `${application.id}:${application.revision ?? 0}:${application.status}`).join("|");
  useEffect(() => {
    if (dashboardView !== "pendingReview" && dashboardView !== "reviewedUnsent" && dashboardView !== "sentWithoutNextAction") return;
    const controller = new AbortController();
    fetch("/api/crm", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("CRM unavailable"))))
      .then((data: CrmViewData) => {
        if (controller.signal.aborted) return;
        const views = getCrmOperationalViews(data);
        setCrmViewIds(new Set(views[dashboardView].map((item) => item.id)));
      })
      .catch(() => { if (!controller.signal.aborted) setCrmViewIds(new Set()); });
    return () => controller.abort();
  }, [dashboardView, applicationsKey]);
  const refreshCrmApplications = useCallback(async () => {
    try {
      const response = await fetch("/api/applications");
      if (!response.ok) throw new Error("Could not refresh the application list. Recorded activity is still saved.");
      const list: unknown = await response.json();
      if (!Array.isArray(list)) throw new Error("Could not parse the applications list.");
      setApplications(list as ApplicationSummary[]);
    } catch (error) { showToast(error instanceof Error ? error.message : "Failed to refresh applications.", "error"); }
  }, [showToast]);
  const [importMode, setImportMode] = useState<"manual" | "json">("manual");
  const [jsonText, setJsonText] = useState("");
  const [pendingJobDescription, setPendingJobDescription] = useState("");
  // Saved preparations (one per offer) and the posting identity chosen for the new draft.
  const [preparations, setPreparations] = useState<OfferPreparation[]>([]);
  const [selectedPreparation, setSelectedPreparation] = useState<OfferPreparation | null>(null);
  useEffect(() => {
    if (!showNewModal) return;
    let active = true;
    const frame = requestAnimationFrame(() => setPreparations(listPreparations()));
    fetch("/api/preparations")
      .then((res) => (res.ok ? res.json() : []))
      .then((remoteList: unknown) => {
        if (!active || !Array.isArray(remoteList)) return;
        const local = listPreparations();
        const remoteById = new Map<string, OfferPreparation>();
        for (const item of remoteList) {
          const parsed = OfferPreparationSchema.safeParse(item);
          if (parsed.success) {
            remoteById.set(parsed.data.id, parsed.data);
            const existingLocal = local.find((l) => l.id === parsed.data.id);
            if (!existingLocal || parsed.data.updatedAt > existingLocal.updatedAt) {
              savePreparation(parsed.data);
            }
          }
        }
        for (const item of local) {
          const remote = remoteById.get(item.id);
          if (!remote || item.updatedAt > remote.updatedAt) {
            void fetch("/api/preparations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item),
            }).catch(() => { /* best-effort server sync */ });
          }
        }
        if (active) setPreparations(listPreparations());
      })
      .catch(() => { /* local browser storage remains source of truth offline */ });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [showNewModal]);
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [language, setLanguage] = useState("English");
  const [creating, setCreating] = useState(false);
  const [targetAppIdForMerge, setTargetAppIdForMerge] = useState("");
  const [crmContacts, setCrmContacts] = useState<CrmContact[]>([]);
  const [backupStatus, setBackupStatus] = useState<{
    latestBackupAt: string | null;
    backupCount: number;
    dataChangedSinceBackup: boolean;
    orphanUploadsCount: number;
    staleTempCount: number;
  } | null>(null);
  const [backupBusy, setBackupBusy] = useState<"load" | "create" | "prune" | null>(null);

  // Sync any Job Description and preparations entered in PromptGeneratorModal when New Application opens or regains focus
  useEffect(() => {
    if (!showNewModal || showPromptModal) return;
    const frame = requestAnimationFrame(() => {
      setPreparations(listPreparations());
      try {
        const stored = localStorage.getItem(PENDING_JD_STORAGE_KEY);
        if (stored) {
          const obj = JSON.parse(stored);
          if (obj?.jobDescription && typeof obj.jobDescription === "string") {
            setPendingJobDescription(obj.jobDescription);
          }
        }
      } catch {
        // ignore storage errors
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [showNewModal, showPromptModal]);

  // Same validation as the editor and the creation API; derived, never stored separately.
  const importValidation = useMemo(() => {
    if (importMode !== "json" || !jsonText.trim()) return null;
    const result = validateImportText(jsonText);
    const isPatchMode = result.detectedMode === "outreach_only" || result.detectedMode === "interview_prep";
    const isTriageWithPrep = result.detectedMode === "triage_only" && Boolean(selectedPreparation?.company?.trim() && selectedPreparation?.roleTitle?.trim());
    if (result.ok && !isPatchMode && !isTriageWithPrep && (!result.summary.company?.trim() || !result.summary.roleTitle?.trim())) {
      return { ...result, ok: false, errors: [...result.errors, "To create an application, the JSON must include both company and roleTitle."] };
    }
    return result;
  }, [jsonText, importMode, selectedPreparation]);
  const isPatchImportMode = Boolean(
    importValidation?.ok && (importValidation.detectedMode === "outreach_only" || importValidation.detectedMode === "interview_prep")
  );
  const effectiveMergeTargetId = useMemo(() => {
    if (!isPatchImportMode || !importValidation?.data) return "";
    if (targetAppIdForMerge && applications.some((item) => item.id === targetAppIdForMerge)) {
      return targetAppIdForMerge;
    }
    const rawCompany = String(importValidation.summary.company || "").toLowerCase().trim();
    const rawRole = String(importValidation.summary.roleTitle || "").toLowerCase().trim();
    const match = applications.find((item) => {
      if (rawCompany && rawRole && item.company.toLowerCase().includes(rawCompany) && item.roleTitle.toLowerCase().includes(rawRole)) return true;
      if (rawCompany && item.company.toLowerCase() === rawCompany) return true;
      return false;
    });
    return match?.id || applications[0]?.id || "";
  }, [isPatchImportMode, importValidation, applications, targetAppIdForMerge]);
  const newDialogRef = useRef<HTMLDivElement>(null);
  // Warn (never block) about a probable duplicate of an existing application.
  const duplicateWarnings = useMemo(() => {
    if (!showNewModal) return [];
    const candidateCompany = importMode === "json" ? importValidation?.summary.company : company;
    const candidateRole = importMode === "json" ? importValidation?.summary.roleTitle : roleTitle;
    return findDuplicateOffers({
      company: candidateCompany, roleTitle: candidateRole, jobDescription: pendingJobDescription,
      jobPostingUrl: selectedPreparation?.jobPostingUrl, jobPostingId: selectedPreparation?.jobPostingId,
    }, applications);
  }, [showNewModal, importMode, importValidation, company, roleTitle, pendingJobDescription, selectedPreparation, applications]);

  // Asset Upload States
  const [sigUploading, setSigUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [uploadedSigUrl, setUploadedSigUrl] = useState<string | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [sigEnabled, setSigEnabled] = useState(false);
  const [photoEnabled, setPhotoEnabled] = useState(false);
  const [sigLoadError, setSigLoadError] = useState(false);
  const [photoLoadError, setPhotoLoadError] = useState(false);
  const [showSigPad, setShowSigPad] = useState(false);

  // Load dashboard data
  useEffect(() => {
    const controller = new AbortController();
    async function fetchData() {
      setLoading(true);
      setLoadError(null);
      setMasterLoadError(null);
      const applicationsRequest = async () => {
        try {
          const response = await fetch("/api/applications", { signal: controller.signal });
          if (!response.ok) throw new Error(response.status === 404 ? "Applications list not found (404)." : "Could not load the applications list.");
          const list: unknown = await response.json();
          if (!Array.isArray(list) || !list.every((entry) => entry && typeof entry.id === "string" && typeof entry.company === "string" && typeof entry.roleTitle === "string" && typeof entry.status === "string" && typeof entry.language === "string" && typeof entry.dateModified === "string")) throw new Error("Could not parse the applications response.");
          if (!controller.signal.aborted) setApplications(list as ApplicationSummary[]);
        } catch (error) {
          if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Could not load the applications list.");
        }
      };
      const masterRequest = async () => {
        try {
          const response = await fetch("/api/master-cv", { signal: controller.signal });
          if (!response.ok) throw new Error(response.status === 404 ? "Master CV not found (404)." : "Could not load the Master CV.");
          const parsed = MasterCvSchema.safeParse(await response.json());
          if (!parsed.success) throw new Error("Could not parse the Master CV response.");
          if (controller.signal.aborted) return;
          const cvData = parsed.data;
          setMasterCv({ fullName: cvData.fullName, location: cvData.location, email: cvData.email, languages: cvData.languages });
        } catch (error) {
          if (!controller.signal.aborted) setMasterLoadError(error instanceof Error ? error.message : "Could not load the Master CV.");
        }
      };
      await Promise.allSettled([applicationsRequest(), masterRequest()]);
      if (!controller.signal.aborted) {
        try {
          const savedSig = localStorage.getItem("jas_default_sig");
          const savedPhoto = localStorage.getItem("jas_default_photo");
          if (savedSig) setUploadedSigUrl(savedSig);
          if (savedPhoto) setUploadedPhotoUrl(savedPhoto);
          setSigEnabled(localStorage.getItem("jas_sig_enabled") === "true");
          setPhotoEnabled(localStorage.getItem("jas_photo_enabled") === "true");
        } catch { /* Asset preferences are optional when browser storage is unavailable. */ }
        setLoading(false);
      }
    }
    void fetchData();
    return () => controller.abort();
  }, [reloadKey]);

  const closeNewModal = useCallback(() => {
    if (creating || showPromptModal) return;
    if (importMode === "json" && jsonText.trim() && !confirm("You have unimported JSON pasted. Discard it and close?")) {
      return;
    }
    setShowNewModal(false);
    setJsonText("");
    setSelectedPreparation(null);
    setTargetAppIdForMerge("");
  }, [creating, showPromptModal, importMode, jsonText]);
  // Pause outer dialog trap/Escape while stacked PromptGeneratorModal is open.
  useDialogFocus(newDialogRef, showNewModal && !showPromptModal, closeNewModal, !creating && !showPromptModal);

  const handleSaveTriageOnly = async () => {
    if (!importValidation?.ok || !importValidation.data) return;
    const raw = importValidation.data as Record<string, unknown>;
    const fit = (raw.fitAssessment && typeof raw.fitAssessment === "object" ? raw.fitAssessment : {}) as Record<string, unknown>;
    const jd = (typeof raw.jobDescription === "string" && raw.jobDescription.trim()) ? raw.jobDescription : pendingJobDescription;
    const now = new Date().toISOString();
    const id = selectedPreparation?.id ?? `triage-${Date.now()}`;
    const prepPayload: OfferPreparation = {
      id,
      createdAt: selectedPreparation?.createdAt ?? now,
      updatedAt: now,
      company: importValidation.summary.company || selectedPreparation?.company || "",
      roleTitle: importValidation.summary.roleTitle || selectedPreparation?.roleTitle || "",
      jobDescription: jd,
      ...(selectedPreparation?.jobPostingUrl ? { jobPostingUrl: selectedPreparation.jobPostingUrl } : {}),
      ...(selectedPreparation?.jobPostingId ? { jobPostingId: selectedPreparation.jobPostingId } : {}),
      ...(selectedPreparation?.applicationDeadline ? { applicationDeadline: selectedPreparation.applicationDeadline } : {}),
      ...(selectedPreparation?.salaryExpectationHint ? { salaryExpectationHint: selectedPreparation.salaryExpectationHint } : {}),
      triageResult: {
        company: importValidation.summary.company,
        roleTitle: importValidation.summary.roleTitle,
        language: typeof raw.language === "string" ? raw.language : undefined,
        scoreOutOf10: importValidation.summary.fitScore ?? null,
        probabilityTier: typeof fit.probabilityTier === "string" ? fit.probabilityTier : undefined,
        applyOrSkip: importValidation.summary.applyOrSkip,
        summary: importValidation.summary.fitSummary,
        mainRisks: importValidation.summary.mainRisks,
        rawJson: importValidation.cleanedText || jsonText,
      },
      promptContext: resolvePromptContext(raw.promptContext, readPendingGeneration(jd)).context ?? selectedPreparation?.promptContext,
    };
    setPreparations(savePreparation(prepPayload));
    void fetch("/api/preparations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prepPayload),
    }).catch(() => {});
    setShowNewModal(false);
    setJsonText("");
    setSelectedPreparation(null);
    showToast(`Triage saved to preparations (${prepPayload.triageResult?.applyOrSkip || "evaluated"}).`, "success");
  };

  // Handle create new application
  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();

    let targetCompany = company;
    let targetRoleTitle = roleTitle;
    let targetLanguage = language;

    if (importMode === "json") {
      if (!jsonText.trim()) {
        showToast("Paste or upload JSON content first.", "warning");
        return;
      }
      if (!importValidation?.ok) {
        showToast("Please check your JSON: " + (importValidation?.errors.join(" ") || "invalid format."), "error");
        return;
      }
      if (isPatchImportMode && effectiveMergeTargetId) {
        setCreating(true);
        try {
          const existingRes = await fetch(`/api/applications/${encodeURIComponent(effectiveMergeTargetId)}`);
          if (!existingRes.ok) throw new Error("Could not load the target application.");
          const existingApp = (await existingRes.json()) as Application;
          const provenance = resolvePromptContext(importValidation.data?.promptContext, readPendingGeneration(pendingJobDescription || existingApp.jobDescription || ""));
          const rawInput = provenance.context ? { ...importValidation.data, promptContext: provenance.context } : importValidation.data;
          const merged = normalizeImportedAIJson(rawInput, existingApp, importValidation.cleanedText);
          const archiveRes = await fetch("/api/imports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rawText: jsonText, applicationId: existingApp.id }),
          });
          if (archiveRes.ok) {
            const archived = await archiveRes.json().catch(() => ({}));
            if (merged.importMetadata && archived.runId) merged.importMetadata.runId = archived.runId;
          }
          const putRes = await fetch(`/api/applications/${encodeURIComponent(existingApp.id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(merged),
          });
          if (!putRes.ok) throw new Error("Could not update the target application.");
          confetti({ particleCount: 70, spread: 50, origin: { y: 0.8 } });
          router.push(`/applications/${existingApp.id}`);
        } catch (err: unknown) {
          showToast("Failed to apply update to application: " + (err instanceof Error ? err.message : String(err)), "error");
          setCreating(false);
        }
        return;
      }
      // No invented company or role: both come from the validated JSON (or linked preparation).
      targetCompany = importValidation.summary.company || selectedPreparation?.company || "";
      targetRoleTitle = importValidation.summary.roleTitle || selectedPreparation?.roleTitle || "";
      if (!targetCompany.trim() || !targetRoleTitle.trim()) {
        showToast("Company or role title is missing from the JSON (or select a saved preparation that includes them).", "warning");
        return;
      }
      const parsedLanguage = (importValidation.data as { language?: unknown } | undefined)?.language;
      if (typeof parsedLanguage === "string") targetLanguage = parsedLanguage;
    } else {
      if (!company.trim() || !roleTitle.trim()) {
        showToast("Enter at least a company name and role title.", "warning");
        return;
      }
      targetCompany = company.trim();
      targetRoleTitle = roleTitle.trim();
    }

    setCreating(true);

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: targetCompany,
          roleTitle: targetRoleTitle,
          language: targetLanguage,
          pastedJson: importMode === "json" ? jsonText : undefined,
          jobDescription: pendingJobDescription.trim() || undefined,
          promptContext: readPendingGeneration(pendingJobDescription),
          ...(selectedPreparation?.jobPostingUrl ? { jobPostingUrl: selectedPreparation.jobPostingUrl } : {}),
          ...(selectedPreparation?.jobPostingId ? { jobPostingId: selectedPreparation.jobPostingId } : {}),
          ...(selectedPreparation?.applicationDeadline ? { applicationDeadline: selectedPreparation.applicationDeadline } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Could not create the application");
      }
      const newApp = await res.json();

      try {
        localStorage.removeItem(PENDING_JD_STORAGE_KEY);
        localStorage.removeItem(PENDING_GENERATION_KEY);
      } catch {
        // ignore
      }

      // Update local state for assets to pre-configure signature/photo when available globally
      let needsPut = false;
      if (!newApp.assetSettings.signature.filePath && uploadedSigUrl) {
        newApp.assetSettings.signature.enabled = sigEnabled;
        newApp.assetSettings.signature.filePath = uploadedSigUrl;
        needsPut = true;
      }
      if (!newApp.assetSettings.photo.filePath && uploadedPhotoUrl) {
        newApp.assetSettings.photo.enabled = photoEnabled;
        newApp.assetSettings.photo.filePath = uploadedPhotoUrl;
        needsPut = true;
      }

      if (needsPut) {
        const assetResponse = await fetch(`/api/applications/${newApp.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newApp),
        });
        if (!assetResponse.ok) showToast("Draft created, but default photo or signature could not be applied. Check Layout & Assets in the editor.", "warning");
      }

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
      });

      router.push(`/applications/${newApp.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(err);
      showToast("Error creating draft: " + msg, "error");
      setCreating(false);
    }
  };

  // Inline quick status updater (1-click CRM progression without opening editor)
  const handleQuickStatusChange = async (id: string, nextStatus: string) => {
    const existing = applications.find((entry) => entry.id === id);
    if (!existing || updatingStatusId) return;
    setUpdatingStatusId(id);

    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, revision: (existing as ApplicationSummary & { revision?: number }).revision ?? 0 }),
      });
      if (!res.ok) throw new Error(res.status === 409 ? "This application changed in another tab. Refresh the dashboard before updating its status." : "Could not update status. The list was not changed.");
      const updatedSummary: ApplicationSummary = await res.json();
      setApplications((prev) => prev.map((a) => (a.id === id ? updatedSummary : a)));
      showToast("Status updated.", "success");
      if (["applied", "interviewing", "offered"].includes(nextStatus) && !updatedSummary.crmSummary?.sentOn) {
        setCrmApplicationId(id);
      }
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Could not update status.", "error");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Handle Delete Application
  const handleDeleteApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this application permanently?")) return;
    const existing = applications.find((entry) => entry.id === id);
    if (!existing) return;

    try {
      const revision = (existing as ApplicationSummary & { revision?: number }).revision ?? 0;
      const res = await fetch(`/api/applications/${id}?revision=${revision}`, { method: "DELETE" });
      if (res.ok) {
        setApplications((apps) => apps.filter((a) => a.id !== id));
        showToast("Application deleted.", "info");
      } else {
        showToast(res.status === 409 ? "This application changed in another tab. Refresh the dashboard before deleting it." : "Could not delete. The application remains in your list.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Could not delete the application.", "error");
    }
  };

  // Asset Upload handler
  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "signature" | "photo") => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    const setUploading = type === "signature" ? setSigUploading : setPhotoUploading;
    const setUrl = type === "signature" ? setUploadedSigUrl : setUploadedPhotoUrl;
    const setLoadError = type === "signature" ? setSigLoadError : setPhotoLoadError;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && typeof data.url === "string") {
        setLoadError(false);
        setUrl(data.url);
        try {
          localStorage.setItem(`jas_default_${type === "signature" ? "sig" : "photo"}`, data.url);
          if (type === "signature") {
            localStorage.setItem("jas_sig_enabled", "true");
          } else {
            localStorage.setItem("jas_photo_enabled", "true");
          }
        } catch {
          // ignore storage quota errors
        }
        if (type === "signature") {
          setSigEnabled(true);
        } else {
          setPhotoEnabled(true);
        }
        showToast(type === "photo" ? "Profile photo uploaded." : "Signature uploaded.", "success");
      } else {
        showToast(data.error || "Could not upload file.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Could not upload file.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDrawnSignature = async (blob: Blob): Promise<boolean> => {
    setSigUploading(true);

    const file = new File([blob], "drawn_signature.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "signature");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && typeof data.url === "string") {
        setShowSigPad(false);
        setSigLoadError(false);
        setUploadedSigUrl(data.url);
        try {
          localStorage.setItem("jas_default_sig", data.url);
          localStorage.setItem("jas_sig_enabled", "true");
        } catch {
          // ignore storage errors
        }
        setSigEnabled(true);

        confetti({
          particleCount: 50,
          spread: 40,
          origin: { y: 0.8 },
        });
        showToast("Signature saved.", "success");
        return true;
      } else {
        showToast(data.error || "Could not upload signature. Your drawing is still on the canvas.", "error");
        return false;
      }
    } catch (err) {
      console.error(err);
      showToast("Could not save signature. Your drawing is still on the canvas.", "error");
      return false;
    } finally {
      setSigUploading(false);
    }
  };

  const loadBackupStatus = useCallback(async () => {
    setBackupBusy("load");
    try {
      const params = new URLSearchParams();
      if (uploadedPhotoUrl) params.append("keep", uploadedPhotoUrl);
      if (uploadedSigUrl) params.append("keep", uploadedSigUrl);
      const res = await fetch(`/api/backup?${params.toString()}`);
      if (!res.ok) throw new Error("Could not check backup status.");
      setBackupStatus(await res.json());
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error checking local backups.", "error");
    } finally {
      setBackupBusy(null);
    }
  }, [uploadedPhotoUrl, uploadedSigUrl, showToast]);

  const handleCreateBackup = async () => {
    setBackupBusy("create");
    try {
      const keepAssetPaths = [uploadedPhotoUrl, uploadedSigUrl].filter((v): v is string => Boolean(v));
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_backup", keepAssetPaths }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not create backup.");
      if (data.status) setBackupStatus(data.status);
      showToast(`Verified local backup created (${data.backup?.fileCount ?? 0} files).`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error creating local backup.", "error");
    } finally {
      setBackupBusy(null);
    }
  };

  const handlePruneOrphans = async () => {
    if (!confirm("Remove orphaned uploads and temporary files not referenced by any application or your defaults?")) return;
    setBackupBusy("prune");
    try {
      const keepAssetPaths = [uploadedPhotoUrl, uploadedSigUrl].filter((v): v is string => Boolean(v));
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prune_orphans", keepAssetPaths }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not prune orphaned files.");
      if (data.status) setBackupStatus(data.status);
      showToast(`Cleanup complete: ${data.pruned?.removedCount ?? 0} file(s) removed.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error pruning files.", "error");
    } finally {
      setBackupBusy(null);
    }
  };

  const clearDefaultAsset = (type: "signature" | "photo") => {
    if (type === "signature") {
      setUploadedSigUrl(null);
      setSigEnabled(false);
      setSigLoadError(false);
      try {
        localStorage.removeItem("jas_default_sig");
        localStorage.setItem("jas_sig_enabled", "false");
      } catch {
        // ignore
      }
      showToast("Default signature removed.", "info");
    } else {
      setUploadedPhotoUrl(null);
      setPhotoEnabled(false);
      setPhotoLoadError(false);
      try {
        localStorage.removeItem("jas_default_photo");
        localStorage.setItem("jas_photo_enabled", "false");
      } catch {
        // ignore
      }
      showToast("Default profile photo removed.", "info");
    }
  };

  const toggleSigStatus = () => {
    const nextVal = !sigEnabled;
    setSigEnabled(nextVal);
    try { localStorage.setItem("jas_sig_enabled", String(nextVal)); } catch { /* ignore */ }
  };

  const togglePhotoStatus = () => {
    const nextVal = !photoEnabled;
    setPhotoEnabled(nextVal);
    try { localStorage.setItem("jas_photo_enabled", String(nextVal)); } catch { /* ignore */ }
  };

  // Statistics computation
  const totalCount = applications.length;
  const draftCount = applications.filter((a) => a.status === "draft").length;
  const reviewedCount = applications.filter((a) => a.status === "reviewed").length;
  const appliedCount = applications.filter((a) => a.status === "applied").length;
  const interviewingCount = applications.filter((a) => a.status === "interviewing").length;
  const offeredCount = applications.filter((a) => a.status === "offered").length;
  const rejectedCount = applications.filter((a) => a.status === "rejected").length;
  const archivedCount = applications.filter((a) => a.status === "archived").length;

  const statsConfig = [
    { key: "all", label: "All", count: totalCount, dot: "bg-blue-300" },
    { key: "draft", label: "Drafts", count: draftCount, dot: "bg-slate-400" },
    { key: "reviewed", label: "Reviewed", count: reviewedCount, dot: "bg-indigo-400" },
    { key: "applied", label: "Applied", count: appliedCount, dot: "bg-emerald-400" },
    { key: "interviewing", label: "Interviewing", count: interviewingCount, dot: "bg-amber-400" },
    { key: "offered", label: "Offered", count: offeredCount, dot: "bg-emerald-300" },
    { key: "rejected", label: "Rejected", count: rejectedCount, dot: "bg-rose-400" },
    { key: "archived", label: "Archived", count: archivedCount, dot: "bg-slate-500" },
  ];

  const effectiveViewIds = useMemo(
    () => computeDashboardViewIds(applications, dashboardView, crmViewIds),
    [applications, dashboardView, crmViewIds]
  );

  const funnelAnalytics = useMemo(
    () => computeDashboardFunnelAnalytics(applications),
    [applications]
  );

  const filteredApps = filterAndSortApplications(applications, {
    viewIds: effectiveViewIds,
    searchQuery,
    statusFilter,
    languageFilter,
    roleTypeFilter,
    fitDecisionFilter,
    sortBy,
  });

  const scoredApps = applications.filter(
    (a) => typeof a.fitAssessment?.scoreOutOf10 === "number"
  );
  const avgFitScore =
    scoredApps.length > 0
      ? (
          scoredApps.reduce((sum, a) => sum + (a.fitAssessment?.scoreOutOf10 || 0), 0) /
          scoredApps.length
        ).toFixed(1)
      : null;

  const advancedFilterCount = [languageFilter, roleTypeFilter, fitDecisionFilter].filter((value) => value !== "all").length;
  const advancedFiltersOpen = showAdvancedFilters || advancedFilterCount > 0;

  const hasActiveFilters =
    dashboardView !== "all" ||
    statusFilter !== "all" ||
    searchQuery.trim() !== "" ||
    advancedFilterCount > 0;

  const resetAllFilters = () => {
    setDashboardView("all");
    setStatusFilter("all");
    setSearchQuery("");
    setLanguageFilter("all");
    setRoleTypeFilter("all");
    setFitDecisionFilter("all");
    setSortBy("dateModified");
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "draft":
        return {
          border: "border-l-slate-500/70 hover:border-l-slate-400",
          bg: "bg-slate-500/10 text-slate-300 border-slate-500/30",
          label: "Draft",
        };
      case "reviewed":
        return {
          border: "border-l-indigo-400/80 hover:border-l-indigo-300",
          bg: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
          label: "Reviewed",
        };
      case "exported":
        return {
          border: "border-l-sky-400/80 hover:border-l-sky-300",
          bg: "bg-sky-500/10 text-sky-300 border-sky-500/30",
          label: "Exported",
        };
      case "applied":
        return {
          border: "border-l-emerald-500/80 hover:border-l-emerald-400",
          bg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
          label: "Applied",
        };
      case "interviewing":
        return {
          border: "border-l-amber-500/80 hover:border-l-amber-400",
          bg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
          label: "Interviewing",
        };
      case "offered":
        return {
          border: "border-l-emerald-400 hover:border-l-emerald-300",
          bg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35",
          label: "Offered",
        };
      case "rejected":
        return {
          border: "border-l-rose-500/70 hover:border-l-rose-400",
          bg: "bg-rose-500/10 text-rose-300 border-rose-500/30",
          label: "Rejected",
        };
      case "archived":
        return {
          border: "border-l-slate-600/70 hover:border-l-slate-500",
          bg: "bg-slate-700/20 text-slate-400 border-slate-600/30",
          label: "Archived",
        };
      default:
        return {
          border: "border-l-slate-500/70 hover:border-l-slate-400",
          bg: "bg-slate-500/10 text-slate-300 border-slate-500/30",
          label: status || "Draft",
        };
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[var(--ui-inset)] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6d8ead]"></div>
        <p className="mt-4 text-blue-300">Loading your applications…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[var(--ui-inset)] px-6 text-white">
        <h1 className="text-xl font-bold">Applications unavailable</h1>
        <p role="alert" className="max-w-lg text-center text-amber-200">
          {loadError} Data could not be loaded. Your saved applications have not been deleted.
        </p>
        <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="rounded-lg border border-[#6d8ead]/50 bg-[#10233f] px-4 py-2">
          Retry loading applications
        </button>
        <Link href="/master-cv" className="text-blue-300 underline">Open Master CV</Link>
      </div>
    );
  }

  const activeTimeZone = getAppTimeZone();

  return (
    <div className="ui-shell ui-controls min-w-0 flex-1 font-sans selection:bg-blue-500/30">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-[var(--ui-border)] bg-[#0b1220]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-400/25 bg-gradient-to-br from-blue-500/20 to-indigo-500/10 text-xs font-bold tracking-wider text-blue-200 shadow-inner">
              JAS
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">Job Application Studio</h1>
              <p className="text-xs text-slate-400">Local CVs, cover letters &amp; job search CRM</p>
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
            <Link
              href="/master-cv"
              className="ui-button ui-button--quiet whitespace-nowrap"
            >
              <FileText className="w-4 h-4 text-blue-300" /> Master CV
            </Link>
            <button
              onClick={() => setShowPromptModal(true)}
              className="ui-button ui-button--secondary whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-blue-300" /> Prompt Studio
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="ui-button ui-button--primary whitespace-nowrap flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4" /> New Application
            </button>
          </div>
        </div>
      </header>

      {masterLoadError && (
        <div role="alert" className="max-w-7xl mx-auto mt-5 px-6 text-sm text-amber-200">
          <p>{masterLoadError} Your applications are still available.</p>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mt-1 underline">
            Retry loading Master CV
          </button>
        </div>
      )}

      {/* Daily Command Center */}
      <CrmDashboard
        onApplicationsChanged={refreshCrmApplications}
        onContactsLoaded={setCrmContacts}
        refreshToken={applications.map((application) => `${application.id}:${application.revision ?? 0}:${application.status}`).join("|")}
      />

      {/* Applications first; profile & maintenance tools remain cleanly tucked below. */}
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6">
        {/* Applications tracker */}
        <section className="min-w-0 space-y-4" aria-label="Applications">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
              <Briefcase className="w-5 h-5 text-blue-300" />
              Applications {statusFilter !== "all" && <span className="text-sm font-medium text-blue-300">({statsConfig.find((stat) => stat.key === statusFilter)?.label || statusFilter})</span>}
            </h3>
            <div className="flex flex-wrap items-center gap-2.5">
              {avgFitScore && (
                <span className="text-xs text-slate-400">
                  Average AI Fit: <strong className="font-semibold text-slate-200 tabular-nums">{avgFitScore}/10</strong>
                </span>
              )}
              <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-200 tabular-nums">
                {filteredApps.length} shown / {applications.length} total
              </span>
            </div>
          </div>

          <section aria-label="Filter by status" className="space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {statsConfig.map((stat) => {
                const isActive = statusFilter === stat.key;
                const isMutedZero = !isActive && stat.count === 0 && stat.key !== "all";
                return (
                  <button
                    key={stat.key}
                    onClick={() => setStatusFilter(stat.key)}
                    aria-pressed={isActive}
                    className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                      isActive
                        ? "border-blue-400/60 bg-blue-500/15 text-blue-100 shadow-sm"
                        : isMutedZero
                        ? "border-[var(--ui-border)] bg-transparent text-slate-500 opacity-70 hover:opacity-100 hover:bg-slate-800/40 hover:text-slate-300"
                        : "border-[var(--ui-border)] bg-[var(--ui-inset)]/70 text-slate-300 hover:border-slate-500/50 hover:bg-slate-800/50 hover:text-white"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${stat.dot}`} />
                    <span className="font-medium">{stat.label}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${isActive ? "bg-blue-400/20 text-white" : "bg-slate-800/80 text-slate-200"}`}>
                      {stat.count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-inset)]/70 px-3.5 py-2 text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[11px] text-blue-300">Funnel</span>
              <span>Applied 7d: <strong className="text-slate-100 tabular-nums">{funnelAnalytics.applied7d}</strong></span>
              <span>Confirmed: <strong className="text-slate-100 tabular-nums">{funnelAnalytics.withConfirmedSend}/{funnelAnalytics.appliedUnique}</strong></span>
              <span>With contact: <strong className="text-slate-100 tabular-nums">{funnelAnalytics.withOutreachOrContact}/{funnelAnalytics.appliedUnique}</strong></span>
              <span>Interviews/Offers: <strong className="text-emerald-300 tabular-nums">{funnelAnalytics.responsesOrInterviews}</strong></span>
              {funnelAnalytics.byLanguage.length > 0 && (
                <span>
                  Languages:{" "}
                  <strong className="text-slate-100 tabular-nums">
                    {funnelAnalytics.byLanguage
                      .map((entry) => {
                        const code = entry.language === "German" ? "DE" : entry.language === "Spanish" ? "ES" : "EN";
                        return `${code} ${entry.total}`;
                      })
                      .join(" · ")}
                  </strong>
                </span>
              )}
              {funnelAnalytics.duplicateCompanies.length > 0 && (
                <span className="rounded border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
                  Possible active duplicate: {funnelAnalytics.duplicateCompanies.map((d) => `${d.company} (${d.count})`).join(", ")}
                </span>
              )}
            </div>
          </section>

          {/* Symmetric Search, Multi-Filter & Sort Toolbar */}
          <div className="ui-panel rounded-xl p-3 space-y-2.5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-12 items-center">
              <div className="relative min-w-0 sm:col-span-2 lg:col-span-5">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search company, role, location, or notes…"
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs focus:outline-none focus:border-[#6d8ead]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={dashboardView}
                onChange={(e) => { setCrmViewIds(null); setDashboardView(e.target.value as DashboardView); }}
                aria-label="Operational view"
                className="w-full min-w-0 lg:col-span-3 px-2.5 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-xs text-white cursor-pointer focus:outline-none focus:border-[#6d8ead]"
              >
                <option value="all">All applications</option>
                <option value="pendingReview">Pending review</option>
                <option value="reviewedUnsent">Reviewed, not sent</option>
                <option value="sentWithoutNextAction">Sent without next action</option>
                <option value="unconfirmedApplied">Sent without confirmed date</option>
                <option value="readyToSend">Ready to send (Fit ≥ 7.5)</option>
                <option value="staleDrafts48h">Stale drafts &gt; 48h</option>
                <option value="sentWithoutContact">Sent without contact</option>
                <option value="noResponse5d">No response &gt; 5 days</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as DashboardSortBy)}
                aria-label="Sort applications"
                className="w-full min-w-0 lg:col-span-2 px-2.5 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-xs text-blue-200 font-medium cursor-pointer focus:outline-none focus:border-[#6d8ead]"
              >
                <option value="dateModified">Sort: Last edited</option>
                <option value="fitScoreDesc">Sort: AI Fit ↓</option>
                <option value="fitScoreAsc">Sort: AI Fit ↑</option>
                <option value="companyAsc">Sort: Company A–Z</option>
              </select>

              <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters((prev) => !prev)}
                  aria-expanded={advancedFiltersOpen}
                  className="ui-button ui-button--secondary w-full justify-between px-3 text-xs"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-300" />
                    Filters
                    {advancedFilterCount > 0 && (
                      <span className="rounded-full bg-blue-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-blue-200 tabular-nums">
                        {advancedFilterCount}
                      </span>
                    )}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${advancedFiltersOpen ? "rotate-180" : ""}`} />
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="ui-button ui-button--quiet shrink-0 text-xs"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {advancedFiltersOpen && (
              <div className="grid grid-cols-1 gap-2 border-t border-[var(--ui-border)] pt-2.5 sm:grid-cols-3">
                <select
                  value={languageFilter}
                  onChange={(e) => setLanguageFilter(e.target.value)}
                  aria-label="Filter by document language"
                  className="w-full min-w-0 px-2.5 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-xs text-white cursor-pointer focus:outline-none focus:border-[#6d8ead]"
                >
                  <option value="all">All languages</option>
                  <option value="English">English</option>
                  <option value="German">German</option>
                  <option value="Spanish">Spanish</option>
                </select>

                <select
                  value={roleTypeFilter}
                  onChange={(e) => setRoleTypeFilter(e.target.value)}
                  aria-label="Filter by role tier"
                  className="w-full min-w-0 px-2.5 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-xs text-white cursor-pointer focus:outline-none focus:border-[#6d8ead]"
                >
                  <option value="all">All role types</option>
                  <option value="coreTarget">Core Target</option>
                  <option value="bridgeRole">Bridge Role</option>
                  <option value="stretchRole">Stretch Role</option>
                  <option value="stabilityRole">Stability Role</option>
                  <option value="alternativeRole">Alternative Role</option>
                </select>

                <select
                  value={fitDecisionFilter}
                  onChange={(e) => setFitDecisionFilter(e.target.value)}
                  aria-label="Filter by AI recommendation"
                  className="w-full min-w-0 px-2.5 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-xs text-white cursor-pointer focus:outline-none focus:border-[#6d8ead]"
                >
                  <option value="all">All recommendations</option>
                  <option value="Apply">Apply</option>
                  <option value="Apply selectively">Apply selectively</option>
                  <option value="Skip">Skip</option>
                </select>
              </div>
            )}
          </div>

          {filteredApps.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredApps.map((app) => {
                const statusInfo = getStatusStyles(app.status);
                const fitScore = app.fitAssessment?.scoreOutOf10;
                const applyOrSkip = app.fitAssessment?.applyOrSkip;
                const roleType = app.roleClassification?.type || "coreTarget";
                const roleBadge = ROLE_TYPE_LABELS[roleType] || ROLE_TYPE_LABELS.coreTarget;
                const salaryText = app.salaryOffer || app.salaryPositioning?.recommendedRangeEUR;
                const fitColor =
                  typeof fitScore === "number"
                    ? fitScore >= 7.5
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : fitScore >= 5.5
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                    : "bg-slate-800/70 text-slate-400 border-slate-700";

                const draftReady = Boolean(app.crmSummary?.preparationReviewed && app.crmSummary?.eligibility !== "gaps" && app.crmSummary?.hasOffer);
                const draftNote = app.crmSummary?.eligibility === "gaps"
                  ? "Check requirements"
                  : !app.crmSummary?.hasOffer
                  ? "Missing job description"
                  : app.crmSummary?.preparationReviewed
                  ? "Documents reviewed"
                  : "Pending review";

                return (
                  <div
                    key={app.id}
                    onClick={() => router.push(`/applications/${app.id}`)}
                    className={`ui-panel rounded-xl p-4 sm:p-5 cursor-pointer border-l-[3px] ${statusInfo.border} group flex min-w-0 flex-col justify-between relative transition-all duration-150 hover:border-slate-500/45 hover:bg-[#131d31]`}
                  >
                    <div>
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="rounded border border-blue-400/20 bg-[#10233f] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-300">
                            {app.language === "German" ? "DE" : app.language === "Spanish" ? "ES" : "EN"}
                          </span>
                          <span className="truncate text-xs text-slate-400">
                            {roleBadge.label}
                          </span>
                          {typeof fitScore === "number" && (
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${fitColor}`}>
                              Fit {fitScore}/10{applyOrSkip === "Apply" ? " · Apply" : applyOrSkip === "Apply selectively" ? " · Selective" : applyOrSkip === "Skip" ? " · Skip" : ""}
                            </span>
                          )}
                        </div>
                        <time
                          dateTime={app.dateModified}
                          title="Last edited"
                          className="shrink-0 text-[11px] text-slate-400 tabular-nums"
                        >
                          {new Date(app.dateModified).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            timeZone: activeTimeZone,
                          })}
                        </time>
                      </div>

                      <h4 className="line-clamp-2 break-words text-[15px] font-semibold leading-snug text-white transition-colors group-hover:text-blue-200">
                        {app.roleTitle}
                      </h4>
                      <p className="mt-1 break-words text-sm leading-5 text-slate-200">
                        {app.company}
                        {app.jobLocation ? <span className="text-slate-400"> · {app.jobLocation}</span> : ""}
                        {app.workModel ? <span className="text-slate-400"> ({app.workModel})</span> : ""}
                      </p>

                      {(salaryText || app.interviewDate || app.recruiterContact || app.crmSummary?.sentOn) && (
                        <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                          {salaryText && (
                            <span className="font-medium text-slate-300 break-words">
                              {salaryText}
                            </span>
                          )}
                          {app.crmSummary?.sentOn && (
                            <span className="text-emerald-300/90">Confirmed sent: {app.crmSummary.sentOn}</span>
                          )}
                          {app.interviewDate && (
                            <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-200 break-words">
                              {app.interviewDate}
                            </span>
                          )}
                          {app.recruiterContact && (
                            <span className="truncate max-w-full" title={app.recruiterContact}>
                              Contact: {app.recruiterContact}
                            </span>
                          )}
                        </div>
                      )}
                      {!app.crmSummary?.sentOn && ["applied", "interviewing", "offered"].includes(app.status) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-amber-200/90">Submission date unconfirmed</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCrmApplicationId(app.id);
                            }}
                            className="rounded-md border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/20"
                          >
                            Confirm submission &amp; add follow-up
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--ui-border)] pt-3 z-10">
                      <div
                        className="flex min-w-0 flex-wrap items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          aria-label={`Change status for ${app.company}`}
                          value={app.status}
                          disabled={updatingStatusId === app.id}
                          onChange={(e) => handleQuickStatusChange(app.id, e.target.value)}
                          className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border cursor-pointer focus:outline-none ${statusInfo.bg} bg-[var(--ui-inset)]`}
                        >
                          <option value="draft" className="bg-[var(--ui-inset)] text-slate-200">Draft</option>
                          <option value="reviewed" className="bg-[var(--ui-inset)] text-indigo-200">Reviewed</option>
                          <option value="exported" className="bg-[var(--ui-inset)] text-sky-200">Exported</option>
                          <option value="applied" className="bg-[var(--ui-inset)] text-emerald-200">Applied</option>
                          <option value="interviewing" className="bg-[var(--ui-inset)] text-amber-200">Interviewing</option>
                          <option value="offered" className="bg-[var(--ui-inset)] text-emerald-200">Offered</option>
                          <option value="rejected" className="bg-[var(--ui-inset)] text-rose-200">Rejected</option>
                          <option value="archived" className="bg-[var(--ui-inset)] text-slate-400">Archived</option>
                        </select>
                        {app.status === "draft" && (
                          <span className={`inline-flex items-center gap-1.5 text-xs ${draftReady ? "text-emerald-300" : "text-amber-200/90"}`}>
                            <CheckCircle className="w-3 h-3 shrink-0" /> {draftNote}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); setCrmApplicationId(app.id); }}
                          className="ui-button ui-button--secondary text-xs px-2.5 py-1.5"
                          aria-label={`Log activity for ${app.company}`}
                        >
                          Activity
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/applications/${app.id}`);
                          }}
                          title="Edit application"
                          aria-label={`Edit application for ${app.company}`}
                          className="ui-button ui-button--quiet"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteApp(app.id, e)}
                          title="Delete application"
                          aria-label={`Delete application for ${app.company}`}
                          className="ui-button ui-button--danger-subtle"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-[var(--ui-border)] bg-[var(--ui-panel)] p-12 text-center">
              <Briefcase className="w-12 h-12 text-slate-400 mx-auto mb-4 opacity-50" />
              {applications.length === 0 ? (
                <>
                  <h4 className="text-white font-bold mb-1">No applications yet</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
                    Create an application to draft your first tailored CV and cover letter.
                  </p>
                  <button
                    onClick={() => setShowNewModal(true)}
                    className="ui-button ui-button--primary"
                  >
                    Create First Application
                  </button>
                </>
              ) : (
                <>
                  <h4 className="text-white font-bold mb-1">No matching applications</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
                    No applications match your current search query and active filters.
                  </p>
                  <button
                    onClick={resetAllFilters}
                    className="ui-button ui-button--primary"
                  >
                    Reset Filters
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        {/* Secondary Workspace Tools (Profile, Default Assets & Local Backups) */}
        <section className="space-y-3 pt-1" aria-label="Workspace tools">
          <details
            className="ui-panel rounded-xl p-4 sm:p-5"
            onToggle={(e) => {
              if (e.currentTarget.open && !backupStatus && backupBusy === null) {
                void loadBackupStatus();
              }
            }}
          >
            <summary className="cursor-pointer text-sm font-semibold text-slate-200">
              Profile, Default Assets &amp; Local Backups
            </summary>
            <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
              {/* Master CV Card */}
              <div className="ui-panel rounded-xl p-6 relative overflow-hidden group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-300" />
                    <h3 className="text-lg font-bold text-white">Master CV</h3>
                  </div>
                  <Link
                    href="/master-cv"
                    className="ui-button ui-button--secondary"
                  >
                    Edit Master CV
                  </Link>
                </div>

                {masterCv ? (
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{masterCv.fullName}</h4>
                      <p className="text-xs text-slate-400">{masterCv.location}</p>
                    </div>

                    <div className="border-t border-[var(--ui-border)] pt-3">
                      <span className="text-xs uppercase tracking-wider text-blue-300 block mb-1">Profile Languages</span>
                      <div className="flex flex-wrap gap-1.5">
                        {masterCv.languages.map((l, i) => (
                          <span key={i} className="text-xs bg-[#10233f]/60 px-2 py-0.5 rounded border border-[#6d8ead]/10 text-slate-300">
                            {l.language} ({l.level})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No Master CV configured yet.</p>
                )}
              </div>

              {/* Global Asset Uploads (Signature & Photo) */}
              <div className="ui-panel rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-[var(--ui-border)]">
                  <ImageIcon className="w-5 h-5 text-blue-300" />
                  <h3 className="text-lg font-bold text-white">Default Photo &amp; Signature</h3>
                </div>

                {/* Photo Asset */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">Profile Photo</span>
                      <span className="text-xs text-slate-400">Used in photo-enabled CV templates (3:4 portrait).</span>
                    </div>
                    <input
                      type="checkbox"
                      aria-label="Enable default profile photo"
                      checked={photoEnabled}
                      onChange={togglePhotoStatus}
                      className="w-4 h-4 rounded border-[var(--ui-border)] text-blue-300 focus:ring-[#6d8ead] accent-[#6d8ead] cursor-pointer"
                      disabled={!uploadedPhotoUrl}
                    />
                  </div>

                  {uploadedPhotoUrl ? (
                    <div className="space-y-2 bg-[var(--ui-inset)] p-2.5 rounded-xl border border-[var(--ui-border)]">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={uploadedPhotoUrl}
                          alt="Profile photo preview"
                          onLoad={() => setPhotoLoadError(false)}
                          onError={() => setPhotoLoadError(true)}
                          className="w-16 h-[86px] rounded-lg object-cover object-[center_14%] border border-[#6d8ead]/50 bg-slate-900 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-blue-300 font-semibold truncate">Executive Portrait (3:4)</p>
                          <p className="text-xs text-slate-400">
                            {photoEnabled ? "Enabled by default (size and placement adjustable in editor)" : "Disabled by default"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <label className="cursor-pointer rounded px-1.5 py-0.5 text-xs font-semibold text-blue-300 hover:underline focus-within:outline-2 focus-within:outline-[var(--ui-focus)]">
                            {photoUploading ? "Uploading…" : "Replace"}
                            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => handleAssetUpload(e, "photo")} />
                          </label>
                          <button type="button" onClick={() => clearDefaultAsset("photo")} className="text-xs text-slate-400 hover:text-rose-300">
                            Remove
                          </button>
                        </div>
                      </div>
                      {photoLoadError && (
                        <p className="text-xs text-amber-300">Could not load the saved photo. Please upload a new image.</p>
                      )}
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--ui-border)] hover:border-[#6d8ead]/40 bg-[var(--ui-inset)] hover:bg-[var(--ui-inset)] rounded-xl p-4 cursor-pointer focus-within:outline-2 focus-within:outline-[var(--ui-focus)]">
                      {photoUploading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#6d8ead]"></div>
                      ) : (
                        <>
                          <FileUp className="w-5 h-5 text-blue-300 mb-1.5" />
                          <span className="text-xs text-blue-300 font-medium">Upload Profile Photo</span>
                          <span className="text-xs text-slate-400 mt-0.5">PNG, JPG, or WEBP up to 5 MB</span>
                        </>
                      )}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => handleAssetUpload(e, "photo")} />
                    </label>
                  )}
                </div>

                {/* Signature Asset */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">Handwritten Signature</span>
                      <span className="text-xs text-slate-400">Used in the cover letter closing block</span>
                    </div>
                    <input
                      type="checkbox"
                      aria-label="Enable default signature"
                      checked={sigEnabled}
                      onChange={toggleSigStatus}
                      className="w-4 h-4 rounded border-[var(--ui-border)] text-blue-300 focus:ring-[#6d8ead] accent-[#6d8ead] cursor-pointer"
                      disabled={!uploadedSigUrl}
                    />
                  </div>

                  {uploadedSigUrl ? (
                    <div className="flex flex-col gap-2 bg-[var(--ui-inset)] p-3 rounded-xl border border-[var(--ui-border)]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-blue-300">Saved signature</p>
                        <div className="flex items-center gap-2.5">
                          <button type="button" onClick={() => setShowSigPad(true)} className="ui-button ui-button--quiet">Draw</button>
                          <label className="cursor-pointer rounded px-1.5 py-0.5 text-xs font-semibold text-blue-300 hover:underline focus-within:outline-2 focus-within:outline-[var(--ui-focus)]">
                            {sigUploading ? "Uploading…" : "Replace"}
                            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => handleAssetUpload(e, "signature")} />
                          </label>
                          <button type="button" onClick={() => clearDefaultAsset("signature")} className="text-xs text-slate-400 hover:text-rose-300">
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded-lg flex justify-center border border-[var(--ui-border)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={uploadedSigUrl}
                          alt="Signature preview"
                          onLoad={() => setSigLoadError(false)}
                          onError={() => setSigLoadError(true)}
                          className="h-10 w-auto object-contain"
                        />
                      </div>
                      {sigLoadError && (
                        <p className="text-xs text-amber-300">Could not load the saved signature. Upload or draw a new one.</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--ui-border)] hover:border-[#6d8ead]/40 bg-[var(--ui-inset)] hover:bg-[var(--ui-inset)] rounded-xl p-4 cursor-pointer focus-within:outline-2 focus-within:outline-[var(--ui-focus)]">
                        {sigUploading ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#6d8ead]"></div>
                        ) : (
                          <>
                            <FileUp className="w-5 h-5 text-blue-300 mb-1.5" />
                            <span className="text-xs text-blue-300 font-medium">Upload transparent signature</span>
                            <span className="text-xs text-slate-400 mt-0.5">PNG, JPG, or WEBP; transparent background recommended</span>
                          </>
                        )}
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => handleAssetUpload(e, "signature")} />
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowSigPad(true)}
                        className="ui-button ui-button--secondary w-full"
                      >
                        Draw Signature In-App
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Local Backup & Maintenance Card (100% manual) */}
              <div className="ui-panel rounded-xl p-5 lg:col-span-2 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--ui-border)]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-300" />
                    <div>
                      <h3 className="text-base font-bold text-white">Local Backups &amp; Maintenance</h3>
                      <p className="text-xs text-slate-400">
                        Manual verified snapshots in <code>.local/backups</code> plus full workspace JSON export. Zero background tasks.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadBackupStatus()}
                    disabled={backupBusy !== null}
                    className="ui-button ui-button--quiet text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${backupBusy === "load" ? "animate-spin" : ""}`} /> Check Status
                  </button>
                </div>

                {backupStatus && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] px-3.5 py-2.5 text-xs text-slate-300">
                    <span>
                      Last backup:{" "}
                      <strong className="text-white">
                        {backupStatus.latestBackupAt
                          ? formatLocalDateTime(backupStatus.latestBackupAt)
                          : "None"}
                      </strong>
                    </span>
                    <span>Snapshots: <strong className="text-white tabular-nums">{backupStatus.backupCount}</strong></span>
                    <span className={backupStatus.dataChangedSinceBackup ? "text-amber-200 font-medium" : "text-emerald-300 font-medium"}>
                      {backupStatus.dataChangedSinceBackup ? "Changes since last backup" : "Backup up to date"}
                    </span>
                    <span>
                      Orphaned files:{" "}
                      <strong className="text-white tabular-nums">{backupStatus.orphanUploadsCount + backupStatus.staleTempCount}</strong>
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCreateBackup()}
                    disabled={backupBusy !== null}
                    className="ui-button ui-button--primary text-xs"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> {backupBusy === "create" ? "Creating backup…" : "Create Backup"}
                  </button>
                  <a
                    href="/api/backup?download=workspace"
                    className="ui-button ui-button--secondary text-xs"
                  >
                    <HardDriveDownload className="w-3.5 h-3.5 text-blue-300" /> Download Workspace (.json)
                  </a>
                  <button
                    type="button"
                    onClick={() => void handlePruneOrphans()}
                    disabled={backupBusy !== null || (backupStatus !== null && backupStatus.orphanUploadsCount + backupStatus.staleTempCount === 0)}
                    className="ui-button ui-button--secondary text-xs"
                  >
                    {backupBusy === "prune" ? "Pruning…" : "Prune Local Orphans"}
                  </button>
                </div>
              </div>
            </div>
          </details>
        </section>
      </main>

      {/* New Application Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            ref={newDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-application-title"
            className={`ui-panel w-full ${importMode === "json" ? "max-w-2xl" : "max-w-lg"} max-h-[92vh] overflow-y-auto rounded-xl p-5 relative`}
          >
            <button
              type="button"
              onClick={closeNewModal}
              disabled={creating}
              aria-label="Close new application dialog"
              className="ui-button ui-button--quiet absolute right-4 top-4 p-1.5"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 id="new-application-title" className="text-lg font-semibold text-white mb-1 pr-10 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-300" />
              New Application
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Creates a tailored draft seeded from your Master CV.
            </p>

            {/* Mode Selector Tabs */}
            <div className="flex bg-[var(--ui-inset)] border border-[var(--ui-border)] rounded-xl p-0.5 mb-4 shrink-0">
              <button
                type="button"
                onClick={() => setImportMode("manual")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
                  importMode === "manual" ? "bg-[#10233f] text-blue-300 border border-[#6d8ead]/20" : "text-slate-400 hover:text-white"
                }`}
              >
                Manual Entry
              </button>
              <button
                type="button"
                onClick={() => setImportMode("json")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
                  importMode === "json" ? "bg-[#10233f] text-blue-300 border border-[#6d8ead]/20" : "text-slate-400 hover:text-white"
                }`}
              >
                Import JSON
              </button>
            </div>

            <form onSubmit={handleCreateApplication} className="space-y-4">
              {importMode === "manual" ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5" htmlFor="new-company">Company Name</label>
                    <input
                      type="text"
                      id="new-company"
                      placeholder="e.g. Acme Corp"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white focus:outline-none focus:border-[#6d8ead] transition-colors text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5" htmlFor="new-role">Role Title</label>
                    <input
                      type="text"
                      id="new-role"
                      placeholder="e.g. Senior Product Manager"
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white focus:outline-none focus:border-[#6d8ead] transition-colors text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5" htmlFor="new-language">Document Language</label>
                    <select
                      id="new-language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white focus:outline-none focus:border-[#6d8ead] transition-colors text-sm cursor-pointer"
                    >
                      <option value="English">English</option>
                      <option value="German">German</option>
                      <option value="Spanish">Spanish</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowPromptModal(true)}
                    className="ui-button ui-button--secondary w-full"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Need tailored JSON? Open Prompt Studio
                  </button>
                  <div>
                    <label htmlFor="new-import-file" className="text-xs font-semibold text-slate-300 block mb-1.5">
                      <Download className="inline w-4 h-4 text-blue-300 mr-1" aria-hidden="true" />Upload .json file
                    </label>
                    <input
                      id="new-import-file"
                      type="file"
                      accept=".json,application/json"
                      disabled={creating}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        // The file fills the text field: the same validation applies to both.
                        if (file) file.text().then(setJsonText, () => showToast("Could not read file.", "error"));
                      }}
                      className="block w-full text-xs text-slate-200"
                    />
                  </div>

                  <div>
                    <label htmlFor="new-import-json" className="text-xs uppercase font-bold text-blue-300 mb-1 block">Or paste JSON here:</label>
                    <textarea
                      id="new-import-json"
                      rows={6}
                      placeholder='{ "company": "Acme Corp", "roleTitle": "Senior Product Manager", ... }'
                      value={jsonText}
                      onChange={(e) => setJsonText(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs font-mono focus:border-[#6d8ead] outline-none leading-normal resize-y"
                    />
                    {importValidation && <ImportPreviewPanel validation={importValidation} />}
                    {isPatchImportMode && applications.length === 0 && (
                      <div role="status" className="mt-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-200">
                        This JSON is a partial update ({importValidation?.detectedMode === "interview_prep" ? "STAR Interview Prep" : "Outreach & Portal Q&A"}), but you have no existing applications to attach it to yet. Create an application first or import a full application JSON.
                      </div>
                    )}
                    {isPatchImportMode && applications.length > 0 && (
                      <div className="mt-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 space-y-1.5">
                        <label htmlFor="new-merge-target" className="text-xs font-semibold text-blue-200 block">
                          Target application for this JSON ({importValidation?.detectedMode === "interview_prep" ? "STAR Interview Prep" : "Outreach & Answers"}):
                        </label>
                        <select
                          id="new-merge-target"
                          value={effectiveMergeTargetId}
                          onChange={(e) => setTargetAppIdForMerge(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                        >
                          {applications.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.company} · {item.roleTitle}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {preparations.length > 0 && (
                <div>
                  <label htmlFor="new-preparation" className="text-xs font-semibold text-slate-300 block mb-1.5">Saved Preparation</label>
                  <select
                    id="new-preparation"
                    value={selectedPreparation?.id ?? ""}
                    onChange={(e) => {
                      const item = preparations.find((entry) => entry.id === e.target.value) ?? null;
                      setSelectedPreparation(item);
                      if (item) {
                        setPendingJobDescription(item.jobDescription);
                        if (importMode === "manual") { setCompany(item.company); setRoleTitle(item.roleTitle); }
                      }
                    }}
                    className="w-full px-3.5 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-sm"
                  >
                    <option value="">None</option>
                    {preparations.map((item) => (
                      <option key={item.id} value={item.id}>
                        {[item.company || "No company", item.roleTitle || "no role", new Date(item.updatedAt).toLocaleDateString("en-US", { timeZone: activeTimeZone })].join(" · ")}
                      </option>
                    ))}
                  </select>
                  {selectedPreparation && (selectedPreparation.jobPostingUrl || selectedPreparation.jobPostingId || selectedPreparation.applicationDeadline) && (
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedPreparation.jobPostingUrl && <>URL: {selectedPreparation.jobPostingUrl} · </>}
                      {selectedPreparation.jobPostingId && <>ID: {selectedPreparation.jobPostingId} · </>}
                      {selectedPreparation.applicationDeadline && <>Deadline: {selectedPreparation.applicationDeadline}</>}
                    </p>
                  )}
                </div>
              )}
              {duplicateWarnings.length > 0 && (
                <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-100">
                  <p className="font-semibold">Possible duplicate (you can continue if this is a different role or re-opening):</p>
                  <ul className="list-disc pl-4">
                    {duplicateWarnings.map((warning) => {
                      const match = applications.find((application) => application.id === warning.id);
                      return <li key={warning.id}>{warning.reason}: {match ? `${match.company} · ${match.roleTitle}` : warning.id}</li>;
                    })}
                  </ul>
                </div>
              )}

              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="new-offer-text" className="text-xs uppercase font-bold text-blue-300">
                    Job Description (optional · enables requirement coverage checks)
                  </label>
                  {pendingJobDescription && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingJobDescription("");
                        try {
                          localStorage.removeItem(PENDING_JD_STORAGE_KEY);
                        } catch {
                          // ignore
                        }
                      }}
                      className="text-xs text-slate-400 hover:text-rose-400"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  id="new-offer-text"
                  rows={3}
                  placeholder="Saved job description from Prompt Studio — or paste it here…"
                  value={pendingJobDescription}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPendingJobDescription(next);
                    try {
                      if (next.trim()) {
                        localStorage.setItem(
                          PENDING_JD_STORAGE_KEY,
                          JSON.stringify({ jobDescription: next, companyHint: company.trim(), roleTitleHint: roleTitle.trim(), updatedAt: Date.now() })
                        );
                      } else {
                        localStorage.removeItem(PENDING_JD_STORAGE_KEY);
                      }
                    } catch { /* ignore */ }
                  }}
                  className="w-full p-2.5 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs focus:border-[#6d8ead] outline-none leading-normal resize-y"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeNewModal}
                  className="ui-button ui-button--secondary"
                  disabled={creating}
                >
                  Cancel
                </button>
                {importMode === "json" && importValidation?.ok && importValidation.detectedMode === "triage_only" && (
                  <button
                    type="button"
                    onClick={handleSaveTriageOnly}
                    disabled={creating}
                    className="ui-button ui-button--secondary border border-amber-500/40 text-amber-200 hover:bg-amber-500/15"
                  >
                    Save Triage Only (no CV created)
                  </button>
                )}
                <button
                  type="submit"
                  className="ui-button ui-button--primary min-w-[100px]"
                  disabled={creating || (importMode === "json" && (!importValidation?.ok || (isPatchImportMode && !effectiveMergeTargetId)))}
                >
                  {creating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  ) : isPatchImportMode ? (
                    "Apply to Application"
                  ) : (
                    importMode === "json" ? "Import & Create" : "Create Draft"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Prompt Generator & CRM Dialog */}
      {crmApplicationId && (
        <CrmActionDialog
          key={crmApplicationId}
          applicationId={crmApplicationId}
          deliveries={crmDeliveries?.applicationId === crmApplicationId ? crmDeliveries.options : undefined}
          contacts={crmContacts}
          onClose={() => setCrmApplicationId(null)}
          onSaved={() => { setCrmApplicationId(null); void refreshCrmApplications(); }}
        />
      )}
      <PromptGeneratorModal
        isOpen={showPromptModal}
        onClose={() => setShowPromptModal(false)}
        applications={applications}
      />

      {/* Signature Drawing Pad Overlay */}
      <SignaturePad
        isOpen={showSigPad}
        onClose={() => setShowSigPad(false)}
        onSave={handleSaveDrawnSignature}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
