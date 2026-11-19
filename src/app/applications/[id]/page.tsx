"use client";

import React, { useState, useEffect, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Download, Sparkles, FileText, ChevronDown, Package, CheckCircle2, Clock } from "lucide-react";
import { celebrate as confetti } from "@/lib/celebration";
import { ApplicationSchema, MasterCvSchema, type Application, type MasterCv } from "@/lib/schemas";
import SignaturePad from "@/components/SignaturePad";
import PromptGeneratorModal from "@/components/PromptGeneratorModal";
import { previewImport, type ImportPreview } from "@/lib/importPreview";
import { ImportPreviewPanel } from "@/components/ImportPreviewPanel";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { buildFinalReview, type EditorTab, type ReviewItem } from "@/lib/finalReview";
import { FinalReviewDialog } from "@/components/editor/FinalReviewDialog";
import { autoSaveAllowed, describeSaveFailure, type SaveFailure } from "@/lib/saveStatus";
import { useToast, ToastContainer } from "@/components/Toast";
import { CvProfileTab } from "@/components/editor/CvProfileTab";
import { CvExperienceTab } from "@/components/editor/CvExperienceTab";
import { CvProjectsTab } from "@/components/editor/CvProjectsTab";
import { CvSkillsTab } from "@/components/editor/CvSkillsTab";
import { CoverLetterTab } from "@/components/editor/CoverLetterTab";
import { TrackingTab } from "@/components/editor/TrackingTab";
import { AtsScannerTab } from "@/components/editor/AtsScannerTab";
import { StrategyTab } from "@/components/editor/StrategyTab";
import { FormAnswersTab } from "@/components/editor/FormAnswersTab";
import { AssetsDesignTab } from "@/components/editor/AssetsDesignTab";
import { ApplicationPreviewPane } from "@/components/editor/ApplicationPreviewPane";
import { buildJsonExport, buildDocumentHtml, getDocumentElementId, getProfessionalFilename, getVerifiedPdfKeywords, type DocumentType } from "@/lib/documentExport";
import { downloadPdfBlob } from "@/lib/browserDownload";
import { readPendingGeneration, resolvePromptContext } from "@/lib/generationContext";
import { CrmActionDialog } from "@/components/crm/CrmActionDialog";
import { deliveriesToOptions } from "@/lib/deliveryOptions";
import type { CrmContact, CrmDeliveryOption } from "@/lib/crmSchemas";
import { resolveSelectedReferenceIds, type ReferenceDocumentMeta } from "@/lib/referenceDocuments";
import { formatLocalDateTime } from "@/lib/timeZone";

function decodeHeaderMessage(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

class EditorBodyErrorBoundary extends React.Component<
  { children: React.ReactNode; onExportBackup: () => void; onRetry: () => void },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onExportBackup: () => void; onRetry: () => void }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="ui-panel m-6 mx-auto max-w-xl rounded-xl border border-rose-500/40 p-6 text-slate-100 space-y-4">
          <h2 className="text-base font-bold text-white">Could not render an editor section</h2>
          <p className="text-xs text-slate-300">
            Your in-memory edits and last saved draft are safe. You can download a JSON backup now or retry loading the editor.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={this.props.onExportBackup} className="ui-button ui-button--primary">
              Export JSON Backup
            </button>
            <button type="button" onClick={() => { this.setState({ error: null }); this.props.onRetry(); }} className="ui-button ui-button--secondary">
              Retry Editor
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ApplicationEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const [app, setApp] = useState<Application | null>(null);
  const latestAppRef = useRef<Application | null>(null);
  // Last failed save, shown persistently until a save succeeds. Local edits are always kept.
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);
  useEffect(() => {
    latestAppRef.current = app;
  }, [app]);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>("");
  const savedSnapshotRef = useRef("");
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showSigPad, setShowSigPad] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [showExportJsonMenu, setShowExportJsonMenu] = useState(false);
  const exportJsonMenuRef = useRef<HTMLDivElement>(null);

  // Editor import: one preview for pasted text and files; nothing is applied until accepted.
  const [editorJsonText, setEditorJsonText] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importUndo, setImportUndo] = useState<{ previous: Application; applied: Application } | null>(null);
  const importDialogRef = useRef<HTMLDivElement>(null);
  // Final pre-send review: real page counts (per document, invalidated on edit) and frozen exports.
  const [measuredPages, setMeasuredPages] = useState<{ snapshot: string; cv?: number; letter?: number }>({ snapshot: "" });
  const [masterCvCatalog, setMasterCvCatalog] = useState<MasterCv | null>(null);
  const [availableReferences, setAvailableReferences] = useState<ReferenceDocumentMeta[]>([]);
  const [finalReviewData, setFinalReviewData] = useState<{ deliveries: { id: string; applicationRevision: number; exportedAt: string; documentType: string }[]; master?: MasterCv } | null>(null);
  const [lastExportInfo, setLastExportInfo] = useState<{
    documentType: string;
    sizeBytes: number;
    sizeWarning: boolean;
    deliveryId?: string;
    filename: string;
  } | null>(null);
  const [showCrmModal, setShowCrmModal] = useState(false);
  const [crmDeliveries, setCrmDeliveries] = useState<CrmDeliveryOption[]>([]);
  const [crmContacts, setCrmContacts] = useState<CrmContact[]>([]);
  const [crmInitialAction, setCrmInitialAction] = useState<"register_application" | "schedule_action" | undefined>(undefined);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const backConfirmRef = useRef<HTMLDivElement>(null);
  const [mobilePane, setMobilePane] = useState<"editor" | "preview">("editor");
  const appliedQueryParamsRef = useRef(false);

  // UI Tabs
  const [activeInputTab, setActiveInputTab] = useState<EditorTab>("cv-profile");
  const [activePreviewTab, setActivePreviewTab] = useState<"cv" | "letter" | "prep">("cv");

  // Real-time zoom level of preview pane
  const [zoomScale, setZoomScale] = useState(0.7);

  // Load application details, Master CV catalog, and locally discovered reference PDFs
  useEffect(() => {
    const controller = new AbortController();
    async function loadApp() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/applications/${id}`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "Application not found (404)."
              : "Could not load this application. Your saved data remains intact."
          );
        }
        const json = await res.json();
        if (controller.signal.aborted) return;
        setApp(json);

        // Load asset defaults from localStorage if they aren't configured yet
        let defaultSig: string | null = null;
        let defaultPhoto: string | null = null;
        let sigEnabled = false;
        let photoEnabled = false;
        try {
          defaultSig = localStorage.getItem("jas_default_sig");
          defaultPhoto = localStorage.getItem("jas_default_photo");
          sigEnabled = localStorage.getItem("jas_sig_enabled") === "true";
          photoEnabled = localStorage.getItem("jas_photo_enabled") === "true";
        } catch {
          // ignore storage errors
        }

        const updatedApp: Application = structuredClone(json);
        let modified = false;

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
        latestAppRef.current = updatedApp;
        savedSnapshotRef.current = JSON.stringify(json);
        setLastSavedSnapshot(savedSnapshotRef.current);
        try {
          const savedPref = localStorage.getItem("jas_autosave_enabled");
          if (savedPref !== null) {
            setAutoSaveEnabled(savedPref === "true");
          }
        } catch {
          // ignore storage errors
        }
        if (!appliedQueryParamsRef.current && typeof window !== "undefined") {
          appliedQueryParamsRef.current = true;
          const paramsQuery = new URLSearchParams(window.location.search);
          const requestedTab = paramsQuery.get("tab") as EditorTab | null;
          const requestedPreview = paramsQuery.get("preview");
          const validTabs: EditorTab[] = ["cv-profile", "cv-exp", "cv-projects", "cv-skills", "cover-letter", "assets", "tracking", "ats-scanner", "strategy", "form-answers"];
          if (requestedTab && validTabs.includes(requestedTab)) setActiveInputTab(requestedTab);
          if (requestedPreview === "cv" || requestedPreview === "letter" || requestedPreview === "prep") {
            setActivePreviewTab(requestedPreview);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) setLoadError(err instanceof Error ? err.message : "Could not load application.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadApp();
    fetch("/api/master-cv", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (controller.signal.aborted || !raw) return;
        const parsed = MasterCvSchema.safeParse(raw);
        if (parsed.success) setMasterCvCatalog(parsed.data);
      })
      .catch(() => { /* optional master catalog */ });
    fetch("/api/references", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (controller.signal.aborted || !raw) return;
        const docs = Array.isArray(raw) ? raw : Array.isArray(raw.documents) ? raw.documents : [];
        setAvailableReferences(docs as ReferenceDocumentMeta[]);
      })
      .catch(() => { /* optional local PDF attachments */ });
    return () => controller.abort();
  }, [id, reloadKey]);

  const isDirty = Boolean(app && lastSavedSnapshot && JSON.stringify(app) !== lastSavedSnapshot);

  const handleSave = useCallback(
    (silent = false, isAutoSave = false): Promise<boolean> => {
      const operation = saveQueueRef.current.then(async () => {
        const payload = latestAppRef.current;
        if (!payload) return false;
        const sentSnapshot = JSON.stringify(payload);
        if (sentSnapshot === savedSnapshotRef.current) {
          if (!silent && !isAutoSave) showToast("All changes are already saved.", "info");
          return true;
        }
        setSaving(true);
        try {
          const res = await fetch(`/api/applications/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: sentSnapshot,
          });
          if (res.ok) {
            const response = ApplicationSchema.safeParse(await res.json());
            if (!response.success) throw new Error("Could not verify the saved response. Your edits are still here.");
            const saved = response.data;
            const current = latestAppRef.current;
            if (current) {
              const next = JSON.stringify(current) === sentSnapshot ? saved : {
                ...current, revision: saved.revision, dateModified: saved.dateModified, crm: saved.crm,
              };
              latestAppRef.current = next;
              setApp(next);
            }
            savedSnapshotRef.current = JSON.stringify(saved);
            setLastSavedSnapshot(savedSnapshotRef.current);
            setSaveFailure(null);
            if (!silent) {
              if (!isAutoSave) {
                confetti({
                  particleCount: 50,
                  spread: 40,
                  origin: { y: 0.8 },
                });
              }
              showToast(isAutoSave ? "Draft auto-saved." : "Draft saved.", "success");
            }
            return true;
          } else {
            const failure = await res.json().catch(() => ({}));
            const described = describeSaveFailure(res.status, failure.error, sentSnapshot);
            setSaveFailure(described);
            showToast(described.message, "error");
            return false;
          }
        } catch (err) {
          console.error(err);
          const described = describeSaveFailure(null, undefined, sentSnapshot);
          setSaveFailure(described);
          showToast(described.message, "error");
          return false;
        } finally {
          setSaving(false);
        }
      });
      saveQueueRef.current = operation;
      return operation;
    },
    [id, showToast]
  );

  // Global Ctrl+S / Cmd+S shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSave(false, false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  // 3-second debounced Auto-Save when enabled and dirty
  useEffect(() => {
    // A failed snapshot is not retried in a loop; a new edit (different snapshot) may retry.
    if (!isDirty || !autoSaveEnabled || saving || loading || !app || !autoSaveAllowed(saveFailure, JSON.stringify(app))) return;
    const timer = setTimeout(() => {
      void handleSave(true, true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isDirty, autoSaveEnabled, saving, loading, app, handleSave, saveFailure]);

  // Warn browser tab close / reload when unsaved edits exist
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const flushLatestDraft = async (): Promise<boolean> => {
    // A successful PUT only acknowledges its own snapshot. Edits made during
    // that request must also be saved before leaving or exporting the document.
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!(await handleSave(true))) return false;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (JSON.stringify(latestAppRef.current) === savedSnapshotRef.current) return true;
    }
    showToast("The draft is still changing. Finish editing and try again.", "error");
    return false;
  };

  const handleBackToDashboard = async () => {
    if (isDirty) {
      if (autoSaveEnabled) {
        if (!(await flushLatestDraft())) return;
      } else {
        setShowBackConfirm(true);
        return;
      }
    }
    router.push("/");
  };
  useDialogFocus(backConfirmRef, showBackConfirm, () => setShowBackConfirm(false));

  const toggleAutoSave = () => {
    const next = !autoSaveEnabled;
    setAutoSaveEnabled(next);
    try {
      localStorage.setItem("jas_autosave_enabled", String(next));
    } catch {
      // ignore
    }
    showToast(next ? "Auto-save enabled: saves after 3 seconds of inactivity." : "Auto-save disabled. Press Ctrl+S to save manually.", "info");
  };

  const handleUploadAsset = async (file: File, type: "signature" | "photo", celebrate = false): Promise<boolean> => {
    setExporting(true);
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
        try {
          if (type === "signature") {
            localStorage.setItem("jas_default_sig", data.url);
            localStorage.setItem("jas_sig_enabled", "true");
          } else {
            localStorage.setItem("jas_default_photo", data.url);
            localStorage.setItem("jas_photo_enabled", "true");
          }
        } catch {
          // ignore storage errors
        }
        setApp((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            assetSettings: {
              ...prev.assetSettings,
              [type]: {
                ...prev.assetSettings[type],
                enabled: true,
                filePath: data.url,
              },
            },
          };
        });
        if (celebrate) {
          confetti({
            particleCount: 50,
            spread: 40,
            origin: { y: 0.8 },
          });
        }
        showToast(type === "photo" ? "Profile photo uploaded and applied." : "Signature saved and applied.", "success");
        return true;
      }
      showToast(data.error || "Could not upload file.", "error");
      return false;
    } catch (err) {
      console.error(err);
      showToast(type === "photo" ? "Could not upload photo." : "Could not save signature.", "error");
      return false;
    } finally {
      setExporting(false);
    }
  };

  const handleSaveDrawnSignature = async (blob: Blob) => {
    if (!latestAppRef.current) return;
    const file = new File([blob], "drawn_signature.png", { type: "image/png" });
    const ok = await handleUploadAsset(file, "signature", true);
    if (ok) setShowSigPad(false);
  };

  // Close export menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
      if (exportJsonMenuRef.current && !exportJsonMenuRef.current.contains(e.target as Node)) {
        setShowExportJsonMenu(false);
      }
    };
    const handleMenuEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowExportMenu(false);
        setShowExportJsonMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleMenuEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleMenuEscape);
    };
  }, []);

  // Preview: normalize a copy of the current draft and compare it by section.
  useEffect(() => {
    // Empty text simply shows no preview (derived below); no synchronous state reset here.
    if (!showImportModal || !editorJsonText.trim() || !app) return;
    const base = app;
    const timer = window.setTimeout(() => {
      setImportPreview(previewImport(editorJsonText, base, (data) => {
        const provenance = resolvePromptContext(data.promptContext, readPendingGeneration(typeof data.jobDescription === "string" ? data.jobDescription : base.jobDescription || ""));
        return provenance.context ? { ...data, promptContext: provenance.context } : data;
      }));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [editorJsonText, showImportModal, app]);

  const closeImportModal = useCallback(() => {
    if (importing) return;
    setShowImportModal(false);
    setEditorJsonText("");
    setImportPreview(null);
  }, [importing]);
  useDialogFocus(importDialogRef, showImportModal, closeImportModal, !importing);

  const handleImportJson = async () => {
    if (!app || importing) return;
    const base = app;
    // Re-run on the exact current draft so the accepted result matches what was reviewed.
    let provenanceWarning: string | undefined;
    const result = previewImport(editorJsonText, base, (data) => {
      const provenance = resolvePromptContext(data.promptContext, readPendingGeneration(typeof data.jobDescription === "string" ? data.jobDescription : base.jobDescription || ""));
      provenanceWarning = provenance.warning;
      return provenance.context ? { ...data, promptContext: provenance.context } : data;
    });
    setImportPreview(result);
    if (!result.validation.ok || !result.candidate) return;
    const updated = result.candidate;
    if (provenanceWarning && updated.importMetadata) updated.importMetadata.warnings = [...(updated.importMetadata.warnings || []), provenanceWarning];
    setImporting(true);
    try {
      const archive = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: editorJsonText, applicationId: base.id }),
      });
      const archived = await archive.json().catch(() => ({}));
      if (!archive.ok) throw new Error(archived.error || "Could not archive the original import. Your draft was not changed.");
      if (updated.importMetadata) updated.importMetadata.runId = archived.runId;
      // An import cannot replace edits or a newer revision made while it was archived.
      if (JSON.stringify(latestAppRef.current) !== JSON.stringify(base)) {
        throw new Error("The draft changed while archiving the import. Please review the diff against your current version.");
      }

      latestAppRef.current = updated;
      setApp(updated);
      setImportUndo({ previous: base, applied: updated });
      setEditorJsonText("");
      setImportPreview(null);
      setShowImportModal(false);
      confetti({ particleCount: 80, spread: 50, origin: { y: 0.6 } });
      const changeCount = updated.importMetadata?.changes?.length || 0;
      showToast(
        `JSON imported. ${changeCount ? `${changeCount} content adjustment(s) to review in ATS Audit. ` : ""}You can undo this import until you edit the draft.`,
        "success"
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast("Could not import JSON: " + msg, "error");
    } finally {
      setImporting(false);
    }
  };

  const importUndoAvailable = importUndo !== null && app !== null && JSON.stringify({ ...importUndo.applied, revision: 0, dateModified: "", crm: undefined }) === JSON.stringify({ ...app, revision: 0, dateModified: "", crm: undefined });
  const undoImport = () => {
    if (!importUndo) return;
    setApp((current) => current ? { ...importUndo.previous, revision: current.revision, dateModified: current.dateModified, crm: current.crm } : current);
    setImportUndo(null);
    showToast("Import undone: previous draft restored.", "success");
  };

  const openFinalReview = async () => {
    if (!app) return;
    const [deliveries, master] = await Promise.all([
      fetch(`/api/applications/${encodeURIComponent(app.id)}/deliveries`).then((response) => (response.ok ? response.json() : [])).catch(() => []),
      fetch("/api/master-cv").then((response) => (response.ok ? response.json() : null)).then((data) => { const parsed = MasterCvSchema.safeParse(data); return parsed.success ? parsed.data : undefined; }).catch(() => undefined),
    ]);
    setFinalReviewData({ deliveries: Array.isArray(deliveries) ? deliveries : [], master });
  };

  const buildStyledHtml = (docType: DocumentType, documentApp = latestAppRef.current): string | null => {
    if (!documentApp) return null;
    const element = document.getElementById(getDocumentElementId(documentApp, docType));
    return element ? buildDocumentHtml(documentApp, docType, element.outerHTML) : null;
  };

  const openCrmActionDialog = useCallback(async (preferredAction?: "register_application" | "schedule_action") => {
    const currentApp = latestAppRef.current;
    if (!currentApp) return;
    const hasSend = Boolean(currentApp.crm?.events?.some((ev) => ev.type === "application_sent" && !ev.voidedAt));
    setCrmInitialAction(preferredAction ?? (hasSend ? "schedule_action" : "register_application"));
    try {
      const [delivRes, crmRes] = await Promise.all([
        fetch(`/api/applications/${encodeURIComponent(currentApp.id)}/deliveries`).catch(() => null),
        crmContacts.length > 0 ? Promise.resolve(null) : fetch("/api/crm").catch(() => null),
      ]);
      if (delivRes?.ok) {
        const rawDeliv = await delivRes.json().catch(() => null);
        if (Array.isArray(rawDeliv)) setCrmDeliveries(deliveriesToOptions(rawDeliv));
      }
      if (crmRes?.ok) {
        const rawCrm = await crmRes.json().catch(() => null);
        if (rawCrm && Array.isArray((rawCrm as { contacts?: unknown }).contacts)) {
          setCrmContacts((rawCrm as { contacts: CrmContact[] }).contacts);
        }
      }
    } catch { /* Deliveries and contacts remain optional */ }
    setShowCrmModal(true);
  }, [crmContacts.length]);

  const navigateToTab = useCallback((tab: EditorTab, anchorId?: string, previewTab?: "cv" | "letter" | "prep") => {
    setActiveInputTab(tab);
    setMobilePane("editor");
    if (previewTab) setActivePreviewTab(previewTab);
    if (anchorId) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const target = document.getElementById(anchorId);
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "center" });
            if (target instanceof HTMLElement) target.focus({ preventScroll: true });
          }
        })
      );
    }
  }, []);

  // Export a single document PDF (CV, Letter, or Prep)
  const handleExportPdf = async (docType?: "cv" | "letter" | "prep") => {
    if (!app || exporting) return;
    setExporting(true);
    setShowExportMenu(false);

    if (!(await flushLatestDraft())) { setExporting(false); return; }
    const exportApp = latestAppRef.current;
    if (!exportApp) { setExporting(false); return; }

    const targetType = docType || activePreviewTab;
    const styledHtml = buildStyledHtml(targetType as "cv" | "letter" | "prep");

    if (!styledHtml) {
      showToast("Preview element not found.", "error");
      setExporting(false);
      return;
    }

    const defaultFilename = getProfessionalFilename(exportApp, targetType);

    try {
      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: styledHtml,
          documentType: targetType,
          company: exportApp.company,
          roleTitle: exportApp.roleTitle,
          author: exportApp.cvContent?.header?.fullName,
          language: exportApp.language,
          keywords: getVerifiedPdfKeywords(exportApp),
          fileName: defaultFilename,
          // Ties the export to the saved revision so a delivery record can be frozen.
          applicationId: exportApp.id,
          revision: exportApp.revision ?? 0,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || "The server could not generate the PDF.");
      }

      const blob = await res.blob();
      const finalFilename = res.headers.get("X-Filename") || defaultFilename;
      const sizeBytes = Number(res.headers.get("X-PDF-Size-Bytes") || blob.size);
      const sizeWarning = res.headers.get("X-PDF-Size-Warning") === "exceeds_2mb" || sizeBytes > 2 * 1024 * 1024;
      const deliveryId = res.headers.get("X-Delivery-Id") || undefined;
      const pdfPages = res.headers.get("X-PDF-Pages");
      const pdfWarnings = decodeHeaderMessage(res.headers.get("X-PDF-Warnings"));
      setLastExportInfo({ documentType: targetType, sizeBytes, sizeWarning, deliveryId, filename: finalFilename });
      await downloadPdfBlob(blob, finalFilename, 150);
      if (sizeWarning) {
        showToast(`PDF exceeds 2 MB (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB). Review attachments before uploading to an ATS portal.`, "warning");
      } else if (pdfWarnings) {
        showToast(`PDF generated (${pdfPages ? `${pdfPages} p.` : "A4"}): ${pdfWarnings}`, "warning");
      } else {
        showToast(`PDF downloaded${pdfPages ? ` (${pdfPages} p.)` : ""}: ${finalFilename}`, "success");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not generate PDF. Make sure the local server is running.";
      console.error(err);
      showToast(msg, "error");
    } finally {
      setExporting(false);
    }
  };

  // Export merged PDF bundle (omits hardcoded bookmark titles so /api/merge-pdf localizes them per app.language)
  const handleMergeExport = async (mode: "cv-refs" | "full-bundle" | "references" | "letter-refs") => {
    if (!app || exporting) return;
    setExporting(true);
    setShowExportMenu(false);

    if (!(await flushLatestDraft())) { setExporting(false); return; }
    const exportApp = latestAppRef.current;
    if (!exportApp) { setExporting(false); return; }

    const selectedRefIds = resolveSelectedReferenceIds(exportApp, availableReferences);
    const refParts = selectedRefIds.map((refId) => ({ type: "file" as const, id: refId }));

    if (mode === "references" && refParts.length === 0) {
      showToast(
        availableReferences.length === 0
          ? "No local PDF attachments found. Add your reference or certificate PDFs to public/documents/ first."
          : "No local attachments are selected in Layout & Assets.",
        availableReferences.length === 0 ? "info" : "warning"
      );
      setExporting(false);
      return;
    }

    const packetOrder = exportApp.templateSettings?.packetOrder || "dach";
    const effectiveDocType = mode === "full-bundle" && packetOrder === "ats" ? "ats-bundle" : mode;

    // Build parts array without overriding `title` so /api/merge-pdf generates localized bookmarks (EN/DE/ES).
    const parts: Array<{ type: "html" | "file"; id?: string; content?: string; role?: "deckblatt" | "letter" | "cv" | "html" }> = [];

    if (mode === "references") {
      parts.push(...refParts);
    } else if (mode === "letter-refs") {
      const letterHtml = buildStyledHtml("letter");
      if (!letterHtml) {
        showToast("Cover letter preview not found. Check its content.", "error");
        setExporting(false);
        return;
      }
      parts.push({ type: "html", role: "letter", content: letterHtml });
      if (refParts.length === 0) {
        showToast(
          availableReferences.length === 0
            ? "No PDFs found in public/documents/ — exporting cover letter only."
            : "No attachments selected — exporting cover letter only.",
          "info"
        );
      } else {
        parts.push(...refParts);
      }
    } else if (mode === "full-bundle") {
      const letterHtml = buildStyledHtml("letter");
      if (!letterHtml) {
        showToast("Cover letter preview not found. Check its content.", "error");
        setExporting(false);
        return;
      }
      const cvHtml = buildStyledHtml("cv");
      if (!cvHtml) {
        showToast("CV preview not found.", "error");
        setExporting(false);
        return;
      }
      if (packetOrder === "ats") {
        // Global/ATS portals parse top-of-file first: CV -> Cover Letter -> Selected Attachments
        parts.push({ type: "html", role: "cv", content: cvHtml });
        parts.push({ type: "html", role: "letter", content: letterHtml });
      } else {
        // Standard DACH / European dossier: Cover Letter -> CV -> Selected Attachments
        parts.push({ type: "html", role: "letter", content: letterHtml });
        parts.push({ type: "html", role: "cv", content: cvHtml });
      }
      parts.push(...refParts);
    } else {
      const cvHtml = buildStyledHtml("cv");
      if (!cvHtml) {
        showToast("CV preview not found.", "error");
        setExporting(false);
        return;
      }
      parts.push({ type: "html", role: "cv", content: cvHtml });
      if (refParts.length === 0) {
        showToast(
          availableReferences.length === 0
            ? "No PDFs found in public/documents/ — exporting CV only."
            : "No attachments selected — exporting CV only.",
          "info"
        );
      } else {
        parts.push(...refParts);
      }
    }

    const defaultFilename = getProfessionalFilename(exportApp, effectiveDocType);

    try {
      const res = await fetch("/api/merge-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parts,
          documentType: effectiveDocType,
          company: exportApp.company,
          roleTitle: exportApp.roleTitle,
          author: exportApp.cvContent?.header?.fullName,
          language: exportApp.language,
          keywords: getVerifiedPdfKeywords(exportApp),
          fileName: defaultFilename,
          // Ties the export to the saved revision so a delivery record can be frozen.
          applicationId: exportApp.id,
          revision: exportApp.revision ?? 0,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || "The server could not merge the PDF bundle.");
      }

      const blob = await res.blob();
      const finalFilename = res.headers.get("X-Filename") || defaultFilename;
      const sizeBytes = Number(res.headers.get("X-PDF-Size-Bytes") || blob.size);
      const sizeWarning = res.headers.get("X-PDF-Size-Warning") === "exceeds_2mb" || sizeBytes > 2 * 1024 * 1024;
      const deliveryId = res.headers.get("X-Delivery-Id") || undefined;
      const pdfPages = res.headers.get("X-PDF-Pages");
      setLastExportInfo({ documentType: effectiveDocType, sizeBytes, sizeWarning, deliveryId, filename: finalFilename });
      await downloadPdfBlob(blob, finalFilename, 200);
      if (sizeWarning) {
        showToast(`PDF bundle exceeds 2 MB (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB). Some portals (Workday/Greenhouse) cap uploads at 2 MB — try unchecking optional attachments in Layout & Assets.`, "warning");
      } else {
        showToast(`PDF bundle downloaded${pdfPages ? ` (${pdfPages} p.)` : ""}: ${finalFilename}`, "success");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not merge PDFs. Make sure the local server is running.";
      console.error(err);
      showToast(msg, "error");
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
          [field]: val,
        },
      },
    });
  };

  const updateCvProfile = (val: string) => {
    if (!app) return;
    setApp({
      ...app,
      cvContent: {
        ...app.cvContent,
        professionalProfile: val,
      },
    });
  };

  const updateExperienceBullet = (expIdx: number, bIdx: number, val: string) => {
    if (!app) return;
    const experience = app.cvContent.experience.map((exp, i) =>
      i === expIdx
        ? { ...exp, bullets: exp.bullets.map((b, j) => (j === bIdx ? val : b)) }
        : exp
    );
    setApp({
      ...app,
      cvContent: {
        ...app.cvContent,
        experience,
      },
    });
  };

  const handleAddExperienceBullet = (expIdx: number) => {
    if (!app) return;
    const experience = app.cvContent.experience.map((exp, i) =>
      i === expIdx
        ? { ...exp, bullets: [...exp.bullets, ""] }
        : exp
    );
    setApp({
      ...app,
      cvContent: {
        ...app.cvContent,
        experience,
      },
    });
  };

  const handleRemoveExperienceBullet = (expIdx: number, bIdx: number) => {
    if (!app) return;
    const experience = app.cvContent.experience.map((exp, i) =>
      i === expIdx
        ? { ...exp, bullets: exp.bullets.filter((_, j) => j !== bIdx) }
        : exp
    );
    setApp({
      ...app,
      cvContent: {
        ...app.cvContent,
        experience,
      },
    });
  };

  const updateCoverLetterParagraph = (idx: number, val: string) => {
    if (!app) return;
    const paragraphs = app.coverLetterContent.paragraphs.map((p, i) =>
      i === idx ? { ...p, text: val } : p
    );
    setApp({
      ...app,
      coverLetterContent: {
        ...app.coverLetterContent,
        paragraphs,
      },
    });
  };

  const updateTemplateSettings = (field: string, val: string | number | boolean) => {
    if (!app) return;
    setApp({
      ...app,
      templateSettings: {
        ...app.templateSettings,
        [field]: val,
      },
    });
  };

  const updateAssetSettings = (type: "signature" | "photo", field: string, val: string | number | boolean | undefined) => {
    setApp((prev) => prev ? {
      ...prev,
      assetSettings: {
        ...prev.assetSettings,
        [type]: {
          ...prev.assetSettings[type],
          [field]: val,
        },
      },
    } : prev);
  };

  const updateRoleClassification = (field: string, val: string) => {
    if (!app) return;
    setApp({
      ...app,
      roleClassification: {
        ...app.roleClassification,
        [field]: val,
      },
    });
  };

  const updateFormFieldAnswers = (field: string, val: string) => {
    if (!app) return;
    setApp({
      ...app,
      formFieldAnswers: {
        ...app.formFieldAnswers,
        [field]: val,
      },
    });
  };

  const updateSalaryPositioning = (field: string, val: string) => {
    if (!app) return;
    setApp({
      ...app,
      salaryPositioning: {
        ...app.salaryPositioning,
        [field]: val,
      },
    });
  };

  const updateKeywordStrategy = (field: string, val: string[]) => {
    if (!app) return;
    setApp({
      ...app,
      keywordStrategy: {
        ...app.keywordStrategy,
        [field]: val,
      },
    });
  };

  const updateFitAssessment = (field: string, val: string | number | null | string[]) => {
    if (!app) return;
    setApp({
      ...app,
      fitAssessment: {
        ...app.fitAssessment,
        [field]: val,
      },
    });
  };

  const updateQualityControl = (field: string, val: string | string[]) => {
    if (!app) return;
    setApp({
      ...app,
      qualityControl: {
        ...app.qualityControl,
        [field]: val,
      },
    });
  };

  const updateRecruiterConcern = (idx: number, field: string, val: string) => {
    if (!app) return;
    const likelyConcerns = [...(app.recruiterConcernHandling?.likelyConcerns || [])];
    likelyConcerns[idx] = {
      ...likelyConcerns[idx],
      [field]: val,
    };
    setApp({
      ...app,
      recruiterConcernHandling: {
        ...app.recruiterConcernHandling,
        likelyConcerns,
      },
    });
  };

  const handleAddRecruiterConcern = () => {
    if (!app) return;
    const likelyConcerns = [...(app.recruiterConcernHandling?.likelyConcerns || []), { concern: "", howToNeutralize: "", sentenceToUse: "" }];
    setApp({
      ...app,
      recruiterConcernHandling: {
        ...app.recruiterConcernHandling,
        likelyConcerns,
      },
    });
  };

  const handleRemoveRecruiterConcern = (idx: number) => {
    if (!app) return;
    const likelyConcerns = (app.recruiterConcernHandling?.likelyConcerns || []).filter((_, i) => i !== idx);
    setApp({
      ...app,
      recruiterConcernHandling: {
        ...app.recruiterConcernHandling,
        likelyConcerns,
      },
    });
  };

  const handleExportJson = (target: "full" | "strategic" | "cv" | "letter") => {
    if (!app) return;
    setShowExportJsonMenu(false);

    const { data, filename: defaultFilename } = buildJsonExport(app, target);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    showToast(`JSON (${target}) exported.`, "success");
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#0a0f1d] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6d8ead]"></div>
        <p className="mt-4 text-[#6d8ead]">Loading application…</p>
      </div>
    );
  }

  if (loadError || !app) {
    return (
      <div className="text-white text-center mt-12 space-y-4">
        <p role="alert">{loadError || "Application not found."}</p>
        <button type="button" className="px-4 py-2 bg-slate-700 rounded" onClick={() => setReloadKey((value) => value + 1)}>
          Retry loading application
        </button>
      </div>
    );
  }

  const hasLocalReferences = availableReferences.length > 0;

  return (
    <div className="ui-shell ui-editor flex-1 flex flex-col text-[#ededed]">
      {saveFailure && (
        <div role="alert" className="ui-controls mx-3 mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100 flex flex-wrap items-center gap-3">
          <span className="flex-1 min-w-0">
            Last save failed ({formatLocalDateTime(saveFailure.at)}): {saveFailure.message} Your edits remain on this screen.
            {saveFailure.kind === "conflict"
              ? " Auto-save is paused to avoid overwriting a newer revision."
              : " Making a new edit will re-enable auto-save."}
          </span>
          {saveFailure.kind === "conflict" ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => handleExportJson("full")} className="ui-button ui-button--secondary">
                Export JSON Backup
              </button>
              <button type="button" onClick={() => setReloadKey((v) => v + 1)} className="ui-button ui-button--danger">
                Reload Server Version
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => void handleSave(false, false)} disabled={saving} className="ui-button ui-button--secondary">
              Retry Save
            </button>
          )}
        </div>
      )}

      {/* Editor Header */}
      <header className="ui-editor-header ui-controls shrink-0 relative z-40">
        <div className="ui-editor-identity">
          <button
            type="button"
            onClick={handleBackToDashboard}
            title="Back to Dashboard"
            aria-label="Back to Dashboard"
            className="ui-button ui-button--secondary"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="ui-editor-heading">
            <div className="ui-editor-title-row">
              <h1 className="text-base font-bold text-white leading-tight">
                {app.roleTitle}
              </h1>
              {saving ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Saving…
                </span>
              ) : saveFailure ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-200 border border-rose-500/40">
                  Unsaved changes · save failed
                </span>
              ) : isDirty ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Unsaved changes
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Saved
                </span>
              )}
              <button
                type="button"
                onClick={toggleAutoSave}
                title="Preference: attempt to auto-save 3 seconds after you stop typing. Actual save status is shown to the left."
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                  autoSaveEnabled
                    ? "bg-[#10233f] text-[#6d8ead] border-[#6d8ead]/30 hover:text-white"
                    : "bg-[#0a0f1d] text-slate-500 border-[#1f2937] hover:text-slate-300"
                }`}
              >
                Auto-save: {autoSaveEnabled ? "ON" : "OFF"}
              </button>
            </div>
            <p className="text-xs text-[#6d8ead] font-medium">
              {app.company} · Ctrl+S to save
            </p>
          </div>
        </div>

        <div className="ui-editor-actions">
          {/* Prompt Studio Button */}
          <button
            onClick={() => setShowPromptModal(true)}
            className="ui-button ui-button--secondary"
          >
            <Sparkles className="w-3.5 h-3.5" /> Prompt Studio
          </button>

          {/* Import JSON Button */}
          <button
            onClick={() => setShowImportModal(true)}
            className="ui-button ui-button--secondary"
          >
            <Package className="w-3.5 h-3.5" /> Import JSON
          </button>
          <button type="button" onClick={openFinalReview} className="ui-button ui-button--secondary">
            Final Review
          </button>
          {importUndoAvailable && (
            <button type="button" onClick={undoImport} className="ui-button ui-button--secondary">
              Undo Import
            </button>
          )}

          {/* Preview Tab Toggles */}
          <div className="ui-preview-tabs" role="group" aria-label="Preview document">
            <button
              onClick={() => setActivePreviewTab("cv")}
              aria-pressed={activePreviewTab === "cv"}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                activePreviewTab === "cv" ? "bg-[#10233f] text-[#6d8ead] border border-[#6d8ead]/20" : "text-slate-400 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> CV
            </button>
            <button
              onClick={() => setActivePreviewTab("letter")}
              aria-pressed={activePreviewTab === "letter"}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                activePreviewTab === "letter" ? "bg-[#10233f] text-[#6d8ead] border border-[#6d8ead]/20" : "text-slate-400 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Cover Letter
            </button>
            <button
              onClick={() => setActivePreviewTab("prep")}
              aria-pressed={activePreviewTab === "prep"}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                activePreviewTab === "prep" ? "bg-[#10233f] text-[#6d8ead] border border-[#6d8ead]/20" : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> STAR Prep
            </button>
          </div>

          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="ui-button ui-button--secondary"
          >
            {saving ? (
              <span>Saving…</span>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Save Draft
              </>
            )}
          </button>

          {/* Export Dropdown */}
          <div className="relative ui-export-dropdown" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting}
              className="ui-button ui-button--primary"
              aria-haspopup="menu"
              aria-expanded={showExportMenu}
            >
              {exporting ? (
                <span>Exporting…</span>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" /> Export PDF
                  <ChevronDown className={`w-3 h-3 transition-transform ${showExportMenu ? "rotate-180" : ""}`} />
                </>
              )}
            </button>

            {showExportMenu && (
              <div className="ui-editor-menu absolute right-0 top-full mt-1.5 rounded-xl overflow-hidden z-50">
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
                    <span className="block text-[9px] text-slate-500">Resume only</span>
                  </div>
                </button>
                <button
                  onClick={() => handleExportPdf("letter")}
                  className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-xs text-white hover:bg-[#10233f] transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-[#6d8ead]" />
                  <div>
                    <span className="font-semibold">Download Cover Letter</span>
                    <span className="block text-[9px] text-slate-500">Cover letter only</span>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={!hasLocalReferences}
                  title={hasLocalReferences ? "Export selected local reference/certificate PDFs" : "Place PDF files in public/documents/ to enable attachment exports"}
                  onClick={() => handleMergeExport("references")}
                  className={`w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-xs transition-colors ${
                    hasLocalReferences ? "text-white hover:bg-[#10233f]" : "text-slate-500 cursor-not-allowed opacity-65"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-[#6d8ead]" />
                  <div>
                    <span className="font-semibold">Download Attachments</span>
                    <span className="block text-[9px] text-slate-500">
                      {hasLocalReferences ? "Selected PDFs from public/documents/" : "Add PDFs in public/documents/ first"}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => handleExportPdf("prep")}
                  className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-xs text-white hover:bg-[#10233f] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <div>
                    <span className="font-semibold">Download STAR Prep</span>
                    <span className="block text-[9px] text-slate-500">Printable interview guide</span>
                  </div>
                </button>

                {/* Merged Bundles */}
                <div className="border-t border-[#1f2937] px-3 pt-3 pb-1 mt-1">
                  <p className="text-[9px] uppercase font-bold text-amber-500/70 tracking-wider">Merged Bundles</p>
                </div>
                <button
                  onClick={() => handleMergeExport("cv-refs")}
                  className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-xs text-white hover:bg-[#10233f] transition-colors"
                >
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <div>
                    <span className="font-semibold">CV + Attachments</span>
                    <span className="block text-[9px] text-slate-500">
                      {hasLocalReferences ? "CV merged with selected local PDFs" : "CV (add PDFs in public/documents/ to attach)"}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => handleMergeExport("letter-refs")}
                  className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-xs text-white hover:bg-[#10233f] transition-colors"
                >
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <div>
                    <span className="font-semibold">Cover Letter + Attachments</span>
                    <span className="block text-[9px] text-slate-500">
                      {hasLocalReferences ? "Cover letter with selected local PDFs" : "Cover letter (add PDFs in public/documents/ to attach)"}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => handleMergeExport("full-bundle")}
                  className="w-full px-3 py-2.5 pb-3 text-left flex items-center gap-2.5 text-xs text-white hover:bg-[#10233f] transition-colors rounded-b-xl"
                >
                  <Package className="w-3.5 h-3.5 text-emerald-400" />
                  <div>
                    <span className="font-semibold text-emerald-300">Full Application Bundle</span>
                    <span className="block text-[9px] text-slate-500">
                      {app.templateSettings?.packetOrder === "ats"
                        ? (hasLocalReferences ? "ATS: CV → Cover Letter → Attachments" : "ATS: CV → Cover Letter")
                        : (hasLocalReferences ? "DACH: Cover Letter → CV → Attachments" : "DACH: Cover Letter → CV")}
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Export JSON Dropdown */}
          <div className="relative ui-export-dropdown" ref={exportJsonMenuRef}>
            <button
              type="button"
              onClick={() => setShowExportJsonMenu(!showExportJsonMenu)}
              className="ui-button ui-button--quiet"
              aria-haspopup="menu"
              aria-expanded={showExportJsonMenu}
            >
              <Package className="w-3.5 h-3.5 text-emerald-400" /> Export JSON
              <ChevronDown className={`w-3 h-3 transition-transform ${showExportJsonMenu ? "rotate-180" : ""}`} />
            </button>

            {showExportJsonMenu && (
              <div className="ui-editor-menu absolute right-0 top-full mt-1.5 rounded-xl overflow-hidden z-50">
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
                    <span className="block text-[9px] text-slate-500">All fields, including strategy</span>
                  </div>
                </button>
                <button
                  onClick={() => handleExportJson("strategic")}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 text-xs text-white hover:bg-[#10233f] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <div>
                    <span className="font-semibold">Strategy Only</span>
                    <span className="block text-[9px] text-slate-500">Fit, positioning &amp; objections</span>
                  </div>
                </button>
                <button
                  onClick={() => handleExportJson("cv")}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 text-xs text-white hover:bg-[#10233f] transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-[#6d8ead]" />
                  <div>
                    <span className="font-semibold">CV Content Only</span>
                    <span className="block text-[9px] text-slate-500">Structured resume fields</span>
                  </div>
                </button>
                <button
                  onClick={() => handleExportJson("letter")}
                  className="w-full px-3 py-2.5 text-left flex items-center gap-2 text-xs text-white hover:bg-[#10233f] transition-colors rounded-b-xl"
                >
                  <FileText className="w-3.5 h-3.5 text-[#6d8ead]" />
                  <div>
                    <span className="font-semibold">Cover Letter Only</span>
                    <span className="block text-[9px] text-slate-500">Cover letter fields &amp; paragraphs</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {lastExportInfo && (
        <div role="status" className="ui-controls mx-3 mt-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 flex flex-wrap items-center justify-between gap-2">
          <span>
            PDF exported: <strong>{lastExportInfo.filename}</strong> · {(lastExportInfo.sizeBytes / 1024).toFixed(0)} KB
            {lastExportInfo.sizeWarning && (
              <span className="ml-2 text-amber-300 font-semibold">⚠ Exceeds 2 MB (common ATS portal upload limit)</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { void openCrmActionDialog("register_application"); }}
              className="px-2.5 py-1 rounded-md bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-white font-semibold"
            >
              Already submitted? Log submission &amp; follow-up
            </button>
            <button
              type="button"
              onClick={() => setLastExportInfo(null)}
              aria-label="Dismiss export notice"
              className="text-slate-400 hover:text-white px-1"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Mobile (<1200px) pane switcher */}
      <div className="ui-controls flex min-[1200px]:hidden border-b border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-300">Screen view:</span>
        <div className="flex gap-1.5" role="group" aria-label="Switch between editor and preview">
          <button
            type="button"
            aria-pressed={mobilePane === "editor"}
            onClick={() => setMobilePane("editor")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold border ${mobilePane === "editor" ? "bg-[#10233f] text-white border-[#6d8ead]/40" : "bg-[var(--ui-inset)] text-slate-300 border-[var(--ui-border)]"}`}
          >
            Editor
          </button>
          <button
            type="button"
            aria-pressed={mobilePane === "preview"}
            onClick={() => setMobilePane("preview")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold border ${mobilePane === "preview" ? "bg-[#10233f] text-white border-[#6d8ead]/40" : "bg-[var(--ui-inset)] text-slate-300 border-[var(--ui-border)]"}`}
          >
            A4 Preview
          </button>
        </div>
      </div>

      {/* Editor Split-Screen Pane */}
      <EditorBodyErrorBoundary onExportBackup={() => handleExportJson("full")} onRetry={() => setReloadKey((k) => k + 1)}>
        <div className="ui-editor-workspace">
          {/* Left Side: Form Editor Panel */}
          <div className={`ui-editor-fields ${mobilePane !== "editor" ? "max-[1199px]:hidden" : ""}`}>
            {/* Inner Navigation Tabs */}
            <div className="ui-editor-tabs ui-controls" role="group" aria-label="Application sections">
              {([
                { id: "cv-profile", label: "Profile" },
                { id: "cv-exp", label: "Experience" },
                { id: "cv-projects", label: "Projects" },
                { id: "cv-skills", label: "Skills" },
                { id: "cover-letter", label: "Cover Letter" },
                { id: "strategy", label: "Strategy" },
                { id: "form-answers", label: "Form Answers" },
                { id: "tracking", label: "Tracking" },
                { id: "ats-scanner", label: "ATS Audit" },
                { id: "assets", label: "Layout & Assets" },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveInputTab(tab.id)}
                  aria-pressed={activeInputTab === tab.id}
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
            <div className="ui-editor-form ui-controls space-y-6">
              {activeInputTab === "cv-profile" && (
                <CvProfileTab
                  app={app}
                  setApp={setApp}
                  updateCvHeader={updateCvHeader}
                  updateCvProfile={updateCvProfile}
                  saving={saving}
                  onSave={() => handleSave(false)}
                />
              )}

              {activeInputTab === "cv-exp" && (
                <CvExperienceTab
                  app={app}
                  setApp={setApp}
                  masterCv={masterCvCatalog}
                  updateExperienceBullet={updateExperienceBullet}
                  onAddExperienceBullet={handleAddExperienceBullet}
                  onRemoveExperienceBullet={handleRemoveExperienceBullet}
                  saving={saving}
                  onSave={() => handleSave(false)}
                />
              )}

              {activeInputTab === "cv-projects" && (
                <CvProjectsTab
                  app={app}
                  setApp={setApp}
                  masterCv={masterCvCatalog}
                  saving={saving}
                  onSave={() => handleSave(false)}
                />
              )}

              {activeInputTab === "cv-skills" && (
                <CvSkillsTab
                  app={app}
                  setApp={setApp}
                  saving={saving}
                  onSave={() => handleSave(false)}
                />
              )}

              {activeInputTab === "cover-letter" && (
                <CoverLetterTab
                  app={app}
                  setApp={setApp}
                  updateCoverLetterParagraph={updateCoverLetterParagraph}
                  saving={saving}
                  onSave={() => handleSave(false)}
                  onNotify={showToast}
                />
              )}

              {activeInputTab === "tracking" && (
                <TrackingTab
                  app={app}
                  setApp={setApp}
                  saving={saving}
                  onSave={() => handleSave(false)}
                  onNotify={showToast}
                  onOpenCrmAction={() => { void openCrmActionDialog(); }}
                  onTriggerAppliedCrm={(nextStatus) => {
                    const hasSend = Boolean(app.crm?.events?.some((ev) => ev.type === "application_sent" && !ev.voidedAt));
                    if (nextStatus === "applied" && !hasSend) {
                      showToast("Status updated to Applied. Use 'Log submission / review' to record the submission date in your CRM schedule.", "info");
                    }
                  }}
                />
              )}

              {activeInputTab === "ats-scanner" && (
                <AtsScannerTab
                  app={app}
                  setApp={setApp}
                  onNavigateTab={(tab, anchor) => navigateToTab(tab, anchor)}
                  onOpenPromptModal={() => setShowPromptModal(true)}
                  saving={saving}
                  onSave={() => handleSave(false)}
                  onNotify={showToast}
                />
              )}

              {activeInputTab === "strategy" && (
                <StrategyTab
                  app={app}
                  setApp={setApp}
                  updateFitAssessment={updateFitAssessment}
                  updateRoleClassification={updateRoleClassification}
                  updateSalaryPositioning={updateSalaryPositioning}
                  updateKeywordStrategy={updateKeywordStrategy}
                  handleAddRecruiterConcern={handleAddRecruiterConcern}
                  handleRemoveRecruiterConcern={handleRemoveRecruiterConcern}
                  updateRecruiterConcern={updateRecruiterConcern}
                  updateQualityControl={updateQualityControl}
                  saving={saving}
                  onSave={() => handleSave(false)}
                  onNavigateTab={(tab, anchor) => navigateToTab(tab, anchor)}
                  onOpenPromptModal={() => setShowPromptModal(true)}
                  onNotify={showToast}
                />
              )}

              {activeInputTab === "form-answers" && (
                <FormAnswersTab
                  app={app}
                  setApp={setApp}
                  updateFormFieldAnswers={updateFormFieldAnswers}
                  saving={saving}
                  onSave={() => handleSave(false)}
                  onNotify={showToast}
                />
              )}

              {activeInputTab === "assets" && (
                <AssetsDesignTab
                  app={app}
                  setApp={setApp}
                  updateTemplateSettings={updateTemplateSettings}
                  updateAssetSettings={updateAssetSettings}
                  onOpenSignaturePad={() => setShowSigPad(true)}
                  onUploadAsset={(file, type) => handleUploadAsset(file, type, false)}
                  onNotify={showToast}
                  availableReferences={availableReferences}
                  saving={saving}
                  onSave={() => handleSave(false)}
                />
              )}
            </div>
          </div>

          {/* Right Side: Emulated A4 Live Document Preview Panel */}
          <div className={`min-w-0 flex-1 flex ${mobilePane !== "preview" ? "max-[1199px]:hidden" : ""}`}>
            <ApplicationPreviewPane
              app={app}
              setApp={setApp}
              activePreviewTab={activePreviewTab}
              zoomScale={zoomScale}
              setZoomScale={setZoomScale}
              updateTemplateSettings={updateTemplateSettings}
              onNavigateTab={(tab, anchor) => navigateToTab(tab, anchor)}
              onPagesMeasured={(type, pages) => {
                const snapshot = JSON.stringify({ cv: app.cvContent, letter: app.coverLetterContent, settings: app.templateSettings, assets: app.assetSettings });
                setMeasuredPages((current) => ({ ...(current.snapshot === snapshot ? current : {}), snapshot, [type]: pages }));
              }}
            />
          </div>
        </div>
      </EditorBodyErrorBoundary>

      {/* Signature Drawing Pad Overlay */}
      <SignaturePad
        isOpen={showSigPad}
        onClose={() => setShowSigPad(false)}
        onSave={handleSaveDrawnSignature}
      />

      {/* Prompt Studio Modal */}
      <PromptGeneratorModal
        isOpen={showPromptModal}
        onClose={() => setShowPromptModal(false)}
        initialCompany={app.company}
        initialRoleTitle={app.roleTitle}
        initialLanguage={app.language as "English" | "German" | "Spanish"}
        initialJobDescription={app.jobDescription || ""}
        initialJobPostingUrl={app.jobPostingUrl || ""}
        initialJobPostingId={app.jobPostingId || ""}
        initialDeadline={app.applicationDeadline || ""}
        initialSalaryHint={app.formFieldAnswers?.salaryExpectation || app.salaryPositioning?.recommendedRangeEUR || ""}
        existingApplication={app}
        onJobDescriptionChange={(jd) =>
          setApp((prev) => (prev ? { ...prev, jobDescription: jd } : prev))
        }
      />

      {/* Import JSON Modal: paste and file share one preview; nothing is applied until accepted */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div ref={importDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="editor-import-title" aria-describedby="editor-import-help" className="ui-panel ui-controls w-full max-w-2xl p-6 relative flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex flex-wrap justify-between items-start gap-3 mb-2 z-10">
              <div>
                <h3 id="editor-import-title" className="text-base font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                  Import Application JSON
                </h3>
                <p id="editor-import-help" className="text-xs text-slate-300">
                  Paste JSON from your AI assistant or upload a .json file. Review section-by-section diffs before applying.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => {
                    closeImportModal();
                    setShowPromptModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#10233f] hover:bg-[#163056] text-[#6d8ead] hover:text-white border border-[#6d8ead]/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  Prompt Studio
                </button>
                <button
                  type="button"
                  onClick={closeImportModal}
                  disabled={importing}
                  aria-label="Close import modal"
                  className="text-slate-400 hover:text-white font-bold text-lg px-1"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col my-4 gap-3">
              <div>
                <label htmlFor="editor-import-file" className="font-semibold mb-1 block text-xs">Upload .json file</label>
                <input
                  id="editor-import-file"
                  type="file"
                  accept=".json,application/json"
                  disabled={importing}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    // The file only fills the text: the same validation and comparison apply.
                    file.text().then(setEditorJsonText, () => showToast("Could not read file.", "error"));
                  }}
                  className="block w-full text-xs text-slate-200"
                />
              </div>

              <div className="flex-1 flex flex-col">
                <label htmlFor="editor-import-json" className="font-semibold mb-1 block text-xs">JSON Content</label>
                <textarea
                  id="editor-import-json"
                  data-autofocus
                  rows={6}
                  placeholder='{ "company": "Acme Corp", "roleTitle": "Senior Product Manager", ... }'
                  value={editorJsonText}
                  readOnly={importing}
                  onChange={(e) => setEditorJsonText(e.target.value)}
                  className="w-full flex-1 min-h-[120px] p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs font-mono focus-visible:outline-2 focus-visible:outline-blue-300 leading-normal resize-y"
                />
                {importPreview && editorJsonText.trim() && <ImportPreviewPanel validation={importPreview.validation} diff={importPreview.diff} showSummary={false} />}
              </div>
            </div>

            <div className="flex justify-end gap-3 z-10 shrink-0">
              <button
                type="button"
                onClick={handleImportJson}
                disabled={importing || !editorJsonText.trim() || !importPreview?.validation.ok || !importPreview.candidate || importPreview.diff.length === 0}
                className="ui-button ui-button--primary"
              >
                {importing ? "Importing…" : "Apply Changes"}
              </button>
              <button
                type="button"
                onClick={closeImportModal}
                disabled={importing}
                className="ui-button ui-button--secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {finalReviewData && (() => {
        const pageSnapshot = JSON.stringify({ cv: app.cvContent, letter: app.coverLetterContent, settings: app.templateSettings, assets: app.assetSettings });
        const pages = measuredPages.snapshot === pageSnapshot ? { cv: measuredPages.cv, letter: measuredPages.letter } : {};
        const review = buildFinalReview({
          app,
          master: finalReviewData.master,
          saveState: { dirty: isDirty, failed: Boolean(saveFailure) },
          pages,
          deliveries: finalReviewData.deliveries,
          availableReferences,
        });
        return (
          <FinalReviewDialog
            items={review.items}
            onClose={() => setFinalReviewData(null)}
            onGoTo={(item: ReviewItem) => {
              setFinalReviewData(null);
              navigateToTab(item.tab, item.anchorId, item.previewTab);
            }}
          />
        );
      })()}

      {showBackConfirm && (
        <div className="ui-controls fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
          <div ref={backConfirmRef} role="dialog" aria-modal="true" aria-labelledby="back-confirm-title" tabIndex={-1} className="ui-panel w-full max-w-md rounded-xl p-5 text-slate-100 space-y-4">
            <h2 id="back-confirm-title" className="text-base font-bold text-white">You have unsaved changes</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Would you like to save your draft before returning to the dashboard, leave without saving, or keep editing?
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" data-autofocus onClick={() => setShowBackConfirm(false)} className="ui-button ui-button--secondary">
                Keep Editing
              </button>
              <button type="button" onClick={() => { setShowBackConfirm(false); router.push("/"); }} className="ui-button ui-button--danger">
                Leave Without Saving
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (await flushLatestDraft()) {
                    setShowBackConfirm(false);
                    router.push("/");
                  }
                }}
                className="ui-button ui-button--primary"
              >
                Save &amp; Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {showCrmModal && (
        <CrmActionDialog
          key={`${app.id}-${lastExportInfo?.deliveryId || "crm"}`}
          applicationId={app.id}
          initialActionType={crmInitialAction}
          initialDeliveryId={lastExportInfo?.deliveryId}
          deliveries={crmDeliveries}
          contacts={crmContacts}
          onClose={() => setShowCrmModal(false)}
          onSaved={(updatedApp) => {
            setShowCrmModal(false);
            setLastExportInfo(null);
            if (updatedApp) {
              setApp((current) => {
                if (!current) return updatedApp;
                const dirtyNow = JSON.stringify(current) !== savedSnapshotRef.current;
                if (!dirtyNow) {
                  const snap = JSON.stringify(updatedApp);
                  savedSnapshotRef.current = snap;
                  latestAppRef.current = updatedApp;
                  setLastSavedSnapshot(snap);
                  return updatedApp;
                }
                const merged = {
                  ...current,
                  crm: updatedApp.crm,
                  status: updatedApp.status,
                  revision: updatedApp.revision,
                  dateModified: updatedApp.dateModified,
                };
                latestAppRef.current = merged;
                savedSnapshotRef.current = JSON.stringify({
                  ...JSON.parse(savedSnapshotRef.current || "{}"),
                  crm: updatedApp.crm,
                  status: updatedApp.status,
                  revision: updatedApp.revision,
                  dateModified: updatedApp.dateModified,
                });
                setLastSavedSnapshot(savedSnapshotRef.current);
                return merged;
              });
            } else {
              setReloadKey((k) => k + 1);
            }
            showToast("Activity and follow-up recorded in your CRM.", "success");
          }}
        />
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
