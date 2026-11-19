"use client";

import React, { useEffect, useMemo, useState, useRef, useId } from "react";
import { Copy, Check, X, Sparkles, ChevronDown, ChevronUp, Sliders, CheckSquare, Square, AlertTriangle } from "lucide-react";
import {
  buildExpertCommitteePrompt,
  getCandidateHighlightOptions,
  type PromptBuilderOptions,
  type StrategyAngle,
  type TonePreset,
  type CvLengthMode,
  type PromptMode,
  type AddressingMode,
} from "../lib/promptBuilder";
import { MasterCvSchema, type Application, type ApplicationSummary, type MasterCv } from "../lib/schemas";
import { copyText } from "../lib/clipboard";
import { findDuplicateOffers, listPreparations, savePreparation, removePreparation, type OfferPreparation } from "../lib/offerPreparations";
import { CV_LENGTH_POLICIES } from "../lib/editorialPolicy";
import { createPromptContext, PENDING_GENERATION_KEY } from "../lib/generationContext";
import { preScanOffer } from "../lib/offerPreScan";
import { getAppTimeZone } from "../lib/timeZone";
import { useDialogFocus } from "../lib/useDialogFocus";

export const PENDING_JD_STORAGE_KEY = "jas_pending_job_description";

interface PromptGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCompany?: string;
  initialRoleTitle?: string;
  initialLanguage?: PromptBuilderOptions["targetLanguage"];
  initialJobDescription?: string;
  initialJobPostingUrl?: string;
  initialJobPostingId?: string;
  initialDeadline?: string;
  initialSalaryHint?: string;
  existingApplication?: Application | null;
  applications?: ApplicationSummary[];
  onJobDescriptionChange?: (jd: string) => void;
}

const LANGUAGE_OPTIONS: { value: PromptBuilderOptions["targetLanguage"]; label: string }[] = [
  { value: "auto", label: "Auto — requested application language, or posting language" },
  { value: "English", label: "English" },
  { value: "German", label: "German (Deutsch)" },
  { value: "Spanish", label: "Spanish (Español)" },
];

const LANGUAGE_DISPLAY: Record<string, string> = {
  English: "English",
  German: "German",
  Spanish: "Spanish",
};

const ANGLE_OPTIONS: { value: StrategyAngle; label: string }[] = [
  { value: "auto", label: "Auto — choose from top job priorities" },
  { value: "technical_execution", label: "Technical Execution & Systems" },
  { value: "strategy_leadership", label: "Strategy, Planning & Leadership" },
  { value: "operations_delivery", label: "Operations, Process & Delivery" },
  { value: "client_stakeholder", label: "Client, Stakeholder & Commercial" },
  { value: "governance_compliance", label: "Governance, Quality & Compliance" },
];

const TONE_OPTIONS: { value: TonePreset; label: string }[] = [
  { value: "auto", label: "Auto — match employer tone" },
  { value: "startup_modern", label: "Modern & Direct (Startups / Scale-ups)" },
  { value: "enterprise_formal", label: "Formal & Structured (Enterprise / Corporate)" },
  { value: "technical_direct", label: "Technical & Mechanics-Focused" },
];

const LENGTH_OPTIONS: { value: CvLengthMode; label: string }[] = [
  ...(["auto_clean", "ultra_compact_1p", "comprehensive_2p"] as const).map((value) => ({
    value,
    label: `${value === "ultra_compact_1p" ? "Compact" : value === "comprehensive_2p" ? "Detailed" : "Balanced"} · ${CV_LENGTH_POLICIES[value].minWords}–${CV_LENGTH_POLICIES[value].maxWords} words`,
  })),
];

export default function PromptGeneratorModal({
  isOpen,
  onClose,
  initialCompany = "",
  initialRoleTitle = "",
  initialLanguage = "auto",
  initialJobDescription = "",
  initialJobPostingUrl = "",
  initialJobPostingId = "",
  initialDeadline = "",
  initialSalaryHint = "",
  existingApplication = null,
  applications = [],
  onJobDescriptionChange,
}: PromptGeneratorModalProps) {
  const [targetLanguage, setTargetLanguage] = useState<PromptBuilderOptions["targetLanguage"]>(initialLanguage);
  const [strategyAngle, setStrategyAngle] = useState<StrategyAngle>("auto");
  const [tonePreset, setTonePreset] = useState<TonePreset>("auto");
  const [cvLengthMode, setCvLengthMode] = useState<CvLengthMode>("auto_clean");
  const [promptMode, setPromptMode] = useState<PromptMode>("full_application");
  const [includeInterviewPrep, setIncludeInterviewPrep] = useState(false);
  const [addressingMode, setAddressingMode] = useState<AddressingMode>("auto");
  const [salaryExpectationHint, setSalaryExpectationHint] = useState(initialSalaryHint);
  const [screeningQuestionsText, setScreeningQuestionsText] = useState("");
  const [emphasisHighlights, setEmphasisHighlights] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState("");
  const [companyHint, setCompanyHint] = useState(initialCompany);
  const [roleTitleHint, setRoleTitleHint] = useState(initialRoleTitle);
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [preparationId, setPreparationId] = useState<string | null>(null);
  const [preparations, setPreparations] = useState<OfferPreparation[]>([]);
  const [jobPostingUrl, setJobPostingUrl] = useState(initialJobPostingUrl);
  const [jobPostingId, setJobPostingId] = useState(initialJobPostingId);
  const [applicationDeadline, setApplicationDeadline] = useState(initialDeadline);
  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => setPreparations(listPreparations()));
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);
  const loadPreparation = (id: string) => {
    const item = preparations.find((entry) => entry.id === id);
    if (!item) { setPreparationId(null); return; }
    setPreparationId(item.id);
    setCompanyHint(item.company);
    setRoleTitleHint(item.roleTitle);
    handleJobDescriptionUpdate(item.jobDescription);
    setJobPostingUrl(item.jobPostingUrl ?? "");
    setJobPostingId(item.jobPostingId ?? "");
    setApplicationDeadline(item.applicationDeadline ?? "");
    setSalaryExpectationHint(item.salaryExpectationHint ?? item.promptContext?.options.salaryExpectationHint ?? "");
    const options = item.promptContext?.options;
    if (options) {
      setTargetLanguage(options.targetLanguage);
      setStrategyAngle(options.strategyAngle);
      setTonePreset(options.tonePreset);
      setCvLengthMode(options.cvLengthMode);
      setEmphasisHighlights(options.emphasisHighlights ?? []);
      setCustomInstructions(options.customInstructions ?? "");
      if (options.promptMode) setPromptMode(options.promptMode);
      if (options.addressingMode) setAddressingMode(options.addressingMode);
      setIncludeInterviewPrep(Boolean(options.includeInterviewPrep));
    }
  };
  const [masterCv, setMasterCv] = useState<MasterCv | null>(null);
  const [masterCvSyncStatus, setMasterCvSyncStatus] = useState<"idle" | "loading" | "synced" | "fallback">("idle");
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [masterReloadKey, setMasterReloadKey] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const previousInputsRef = useRef({
    isOpen: false,
    initialCompany,
    initialRoleTitle,
    initialLanguage,
    initialJobDescription,
    initialJobPostingUrl,
    initialJobPostingId,
    initialDeadline,
    initialSalaryHint,
  });

  useEffect(() => {
    const previous = previousInputsRef.current;
    if (isOpen) {
      if (initialCompany && (!previous.isOpen || previous.initialCompany !== initialCompany)) setCompanyHint(initialCompany);
      if (initialRoleTitle && (!previous.isOpen || previous.initialRoleTitle !== initialRoleTitle)) setRoleTitleHint(initialRoleTitle);
      if (!previous.isOpen || previous.initialLanguage !== initialLanguage) setTargetLanguage(initialLanguage);
      if (initialJobDescription !== "" && (!previous.isOpen || previous.initialJobDescription !== initialJobDescription)) {
        setJobDescription(initialJobDescription);
      }
      if (initialJobPostingUrl && (!previous.isOpen || previous.initialJobPostingUrl !== initialJobPostingUrl)) setJobPostingUrl(initialJobPostingUrl);
      if (initialJobPostingId && (!previous.isOpen || previous.initialJobPostingId !== initialJobPostingId)) setJobPostingId(initialJobPostingId);
      if (initialDeadline && (!previous.isOpen || previous.initialDeadline !== initialDeadline)) setApplicationDeadline(initialDeadline);
      if (initialSalaryHint && (!previous.isOpen || previous.initialSalaryHint !== initialSalaryHint)) setSalaryExpectationHint(initialSalaryHint);
    }
    previousInputsRef.current = {
      isOpen,
      initialCompany,
      initialRoleTitle,
      initialLanguage,
      initialJobDescription,
      initialJobPostingUrl,
      initialJobPostingId,
      initialDeadline,
      initialSalaryHint,
    };
  }, [isOpen, initialCompany, initialRoleTitle, initialLanguage, initialJobDescription, initialJobPostingUrl, initialJobPostingId, initialDeadline, initialSalaryHint]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    async function loadMaster() {
      setMasterCvSyncStatus("loading");
      try {
        const response = await fetch("/api/master-cv", { signal: controller.signal });
        if (!response.ok) throw new Error("Master CV unavailable");
        const profile = MasterCvSchema.safeParse(await response.json());
        if (!profile.success) throw new Error("Master CV response invalid");
        if (!controller.signal.aborted) {
          setMasterCv(profile.data);
          setMasterCvSyncStatus("synced");
        }
      } catch {
        if (!controller.signal.aborted) {
          setMasterCv(null);
          setMasterCvSyncStatus("fallback");
        }
      }
    }
    void loadMaster();
    return () => controller.abort();
  }, [isOpen, masterReloadKey]);

  useDialogFocus(dialogRef, isOpen, onClose);

  const highlightOptions = useMemo(
    () => getCandidateHighlightOptions(masterCv || undefined),
    [masterCv]
  );

  const handleJobDescriptionUpdate = (nextJd: string) => {
    setJobDescription(nextJd);
    if (onJobDescriptionChange) {
      onJobDescriptionChange(nextJd);
    }
    try {
      if (nextJd.trim()) {
        localStorage.setItem(
          PENDING_JD_STORAGE_KEY,
          JSON.stringify({
            jobDescription: nextJd,
            companyHint: companyHint.trim(),
            roleTitleHint: roleTitleHint.trim(),
            updatedAt: Date.now(),
          })
        );
      } else if (!onJobDescriptionChange) {
        localStorage.removeItem(PENDING_JD_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  };

  const toggleHighlight = (key: string) => {
    setEmphasisHighlights((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAllHighlights = () => setEmphasisHighlights(highlightOptions.map((item) => item.id));
  const clearHighlights = () => setEmphasisHighlights([]);

  const screeningQuestions = useMemo(
    () => screeningQuestionsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    [screeningQuestionsText]
  );

  const promptOptions = useMemo<PromptBuilderOptions>(() => ({
    promptMode,
    includeInterviewPrep,
    addressingMode,
    generatedAt: new Date().toISOString(),
    targetLanguage,
    strategyAngle,
    tonePreset,
    cvLengthMode,
    emphasisHighlights,
    customInstructions: customInstructions.trim() || undefined,
    screeningQuestions: screeningQuestions.length ? screeningQuestions : undefined,
    companyHint: companyHint.trim() || undefined,
    roleTitleHint: roleTitleHint.trim() || undefined,
    jobPostingUrl: jobPostingUrl.trim() || undefined,
    jobPostingId: jobPostingId.trim() || undefined,
    applicationDeadline: applicationDeadline || undefined,
    salaryExpectationHint: salaryExpectationHint.trim() || undefined,
    jobDescription,
    masterCv: masterCv || undefined,
    existingApplication: existingApplication || undefined,
  }), [
    targetLanguage, promptMode, includeInterviewPrep, addressingMode,
    strategyAngle, tonePreset, cvLengthMode, emphasisHighlights, customInstructions,
    screeningQuestions, companyHint, roleTitleHint, jobPostingUrl, jobPostingId,
    applicationDeadline, salaryExpectationHint, jobDescription, masterCv, existingApplication,
  ]);
  const preScan = useMemo(() => preScanOffer(jobDescription, masterCv || undefined), [jobDescription, masterCv]);
  const prompt = useMemo(() => buildExpertCommitteePrompt(promptOptions), [promptOptions]);
  const earlyDuplicates = useMemo(() => {
    if (!isOpen || !applications.length || (!companyHint.trim() && !roleTitleHint.trim() && !jobDescription.trim() && !jobPostingUrl.trim() && !jobPostingId.trim())) {
      return [];
    }
    return findDuplicateOffers(
      {
        company: companyHint,
        roleTitle: roleTitleHint,
        jobDescription,
        jobPostingUrl,
        jobPostingId,
      },
      applications
    );
  }, [isOpen, applications, companyHint, roleTitleHint, jobDescription, jobPostingUrl, jobPostingId]);

  if (!isOpen) return null;

  const isCvTailoringMode = promptMode === "full_application";
  const showGermanAddressing = targetLanguage === "German" || targetLanguage === "auto" || preScan.detectedLanguage === "German";
  const appTimeZone = getAppTimeZone();

  const handleCopy = async () => {
    const outcome = await copyText(prompt);
    if (outcome !== "copied") {
      setCopyFailed(true);
      return;
    }
    setCopyFailed(false);
    const context = createPromptContext(promptOptions);
    try {
      localStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify(context));
      handleJobDescriptionUpdate(jobDescription);
    } catch {
      // ignore
    }
    const now = new Date().toISOString();
    const id = preparationId ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `prep-${Date.now()}`);
    const existing = preparations.find((item) => item.id === id);
    const prepPayload: OfferPreparation = {
      id, createdAt: existing?.createdAt ?? now, updatedAt: now,
      company: companyHint.trim(), roleTitle: roleTitleHint.trim(), jobDescription,
      ...(jobPostingUrl.trim() ? { jobPostingUrl: jobPostingUrl.trim() } : {}),
      ...(jobPostingId.trim() ? { jobPostingId: jobPostingId.trim() } : {}),
      ...(applicationDeadline ? { applicationDeadline } : {}),
      ...(salaryExpectationHint.trim() ? { salaryExpectationHint: salaryExpectationHint.trim() } : {}),
      ...(existing?.triageResult ? { triageResult: existing.triageResult } : {}),
      promptContext: context,
    };
    setPreparations(savePreparation(prepPayload));
    void fetch("/api/preparations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prepPayload),
    }).catch(() => {});
    setPreparationId(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const fieldClass =
    "w-full min-w-0 px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border-strong)] text-white text-sm";
  const labelClass = "text-xs font-medium text-slate-300 mb-1.5 block";
  const stepBoxClass = "rounded-xl border border-[var(--ui-border)] bg-[var(--ui-inset)]/70 p-4 space-y-3.5 mb-4";

  return (
    <div className="ui-shell ui-controls fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${dialogId}-title`} tabIndex={-1} className="ui-panel w-full max-w-4xl max-h-[94vh] overflow-y-auto rounded-2xl p-5 sm:p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="ui-button ui-button--quiet absolute right-4 top-4 p-1.5"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-wrap items-center gap-2 mb-1 pr-10">
          <h3 id={`${dialogId}-title`} className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-300" />
            Generate AI prompt
          </h3>
          {masterCvSyncStatus === "synced" && masterCv && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
              Master CV loaded ({masterCv.achievementsPool.length} {masterCv.achievementsPool.length === 1 ? "achievement" : "achievements"} · {masterCv.educationHistory.length} education)
            </span>
          )}
          {masterCvSyncStatus === "loading" && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-200 font-semibold">
              Loading Master CV…
            </span>
          )}
        </div>
        {masterCvSyncStatus === "fallback" && (
          <div role="status" className="text-xs text-amber-300 mb-3">
            <p>Could not load your saved Master CV. The default profile template will be used instead — verify your profile before continuing.</p>
            <button type="button" onClick={() => setMasterReloadKey((value) => value + 1)} className="ui-button ui-button--secondary mt-1 underline">
              Retry loading Master CV
            </button>
          </div>
        )}
        <p className="text-xs text-slate-400 mb-4 max-w-3xl">
          Step by step: paste the full job posting, review the local pre-scan, copy the prompt into your AI chat, and then import the JSON output under <strong className="text-white">New Application → Import JSON</strong>.
        </p>

        {/* STEP 1: Offer, Saved Preparations & Pre-Scan */}
        <section className={stepBoxClass} aria-label="Step 1: Job posting and context">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-300">1. Job posting & known context</span>
            {preparations.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
                <select
                  id={`${dialogId}-preparation`}
                  aria-label="Saved preparations"
                  value={preparationId ?? ""}
                  onChange={(e) => (e.target.value ? loadPreparation(e.target.value) : setPreparationId(null))}
                  className="min-w-0 max-w-xs px-2.5 py-1.5 rounded-lg bg-[var(--ui-panel)] border border-[var(--ui-border-strong)] text-white text-xs"
                >
                  <option value="">New preparation or choose saved…</option>
                  {preparations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {[
                        item.company || "Untitled company",
                        item.roleTitle || "untitled role",
                        item.triageResult?.applyOrSkip ? `${item.triageResult.applyOrSkip}${typeof item.triageResult.scoreOutOf10 === "number" ? ` (${item.triageResult.scoreOutOf10}/10)` : ""}` : null,
                        new Date(item.updatedAt).toLocaleDateString("en-US", { timeZone: appTimeZone }),
                      ].filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
                {preparationId && (
                  <button
                    type="button"
                    className="ui-button ui-button--quiet text-xs"
                    onClick={() => { setPreparations(removePreparation(preparationId)); setPreparationId(null); }}
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>

          {(() => {
            const selectedTriage = preparations.find((p) => p.id === preparationId)?.triageResult;
            if (!selectedTriage) return null;
            return (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-100 space-y-1">
                <p className="font-semibold">
                  Saved triage: {selectedTriage.applyOrSkip || "Evaluated"}
                  {typeof selectedTriage.scoreOutOf10 === "number" ? ` · ${selectedTriage.scoreOutOf10}/10` : ""}
                  {selectedTriage.probabilityTier ? ` (${selectedTriage.probabilityTier})` : ""}
                </p>
                {selectedTriage.summary && <p className="text-slate-200">{selectedTriage.summary}</p>}
              </div>
            );
          })()}

          <div>
            <label htmlFor={`${dialogId}-description`} className={labelClass}>
              Full job description
            </label>
            <textarea
              id={`${dialogId}-description`}
              data-autofocus="true"
              rows={5}
              aria-label="Full job description"
              value={jobDescription}
              onChange={(e) => handleJobDescriptionUpdate(e.target.value)}
              placeholder="Paste the complete job posting text here…"
              className="min-w-0 w-full p-3 rounded-xl bg-[var(--ui-panel)] border border-[var(--ui-border-strong)] text-white text-xs font-mono focus:border-[#6d8ead] leading-normal resize-y"
            />
          </div>

          {preScan.wordCount > 0 && (
            <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-3 text-xs space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-slate-300">
                <span className="font-bold text-blue-300">Local pre-scan ({preScan.wordCount} {preScan.wordCount === 1 ? "word" : "words"}):</span>
                {preScan.detectedLanguage && (
                  targetLanguage !== preScan.detectedLanguage ? (
                    <button
                      type="button"
                      onClick={() => setTargetLanguage(preScan.detectedLanguage!)}
                      className="px-2 py-0.5 rounded bg-blue-500/15 border border-blue-400/30 text-blue-200 hover:bg-blue-500/25 cursor-pointer"
                      title="Use detected language in selector"
                    >
                      Detected language: {LANGUAGE_DISPLAY[preScan.detectedLanguage] || preScan.detectedLanguage} (apply)
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-[#10233f] text-slate-200">
                      Language: {LANGUAGE_DISPLAY[preScan.detectedLanguage] || preScan.detectedLanguage}
                    </span>
                  )
                )}
                {preScan.mentionsLanguageRequirement.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/35 text-amber-200 font-medium">
                    Language requirement noted ({preScan.mentionsLanguageRequirement.join(", ")}) — verify before drafting
                  </span>
                )}
                {preScan.detectedSalaryBand && (
                  salaryExpectationHint.trim() ? (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      Posted salary: {preScan.detectedSalaryBand}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSalaryExpectationHint(preScan.detectedSalaryBand!)}
                      className="px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-200 hover:bg-blue-500/25 cursor-pointer"
                    >
                      Detected salary: {preScan.detectedSalaryBand} (use as reference)
                    </button>
                  )
                )}
                {preScan.detectedAddressing && addressingMode === "auto" && (
                  <button
                    type="button"
                    onClick={() => setAddressingMode(preScan.detectedAddressing!)}
                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    German tone: {preScan.detectedAddressing === "du" ? "Du" : "Sie"} (apply)
                  </button>
                )}
              </div>
              {(preScan.matchedInMaster.length > 0 || preScan.missingFromMaster.length > 0) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {preScan.matchedInMaster.length > 0 && (
                    <span className="text-emerald-300">
                      ✓ In Master CV ({preScan.matchedInMaster.length}): {preScan.matchedInMaster.slice(0, 8).join(", ")}
                      {preScan.matchedInMaster.length > 8 ? ` (+${preScan.matchedInMaster.length - 8} more)` : ""}
                    </span>
                  )}
                  {preScan.missingFromMaster.length > 0 && (
                    <span className="text-amber-300">
                      ! Not matched verbatim ({preScan.missingFromMaster.length}): {preScan.missingFromMaster.slice(0, 6).join(", ")}
                      {preScan.missingFromMaster.length > 6 ? ` (+${preScan.missingFromMaster.length - 6} more)` : ""}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {earlyDuplicates.length > 0 && (
            <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-100 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Possible duplicate application in your history:</p>
                <ul className="list-disc pl-4 mt-0.5">
                  {earlyDuplicates.map((d) => {
                    const match = applications.find((a) => a.id === d.id);
                    return <li key={d.id}>{d.reason}: {match ? `${match.company} · ${match.roleTitle}` : d.id}</li>;
                  })}
                </ul>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${dialogId}-company`} className={labelClass}>Company (optional)</label>
              <input
                id={`${dialogId}-company`}
                type="text"
                value={companyHint}
                onChange={(e) => setCompanyHint(e.target.value)}
                placeholder="Leave blank to extract from the posting"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor={`${dialogId}-role`} className={labelClass}>Role title (optional)</label>
              <input
                id={`${dialogId}-role`}
                type="text"
                value={roleTitleHint}
                onChange={(e) => setRoleTitleHint(e.target.value)}
                placeholder="Leave blank to extract from the posting"
                className={fieldClass}
              />
            </div>
          </div>

          <details className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-panel)]/60 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-300">
              Optional posting metadata (URL, job ID, or deadline)
            </summary>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor={`${dialogId}-posting-url`} className={labelClass}>Posting URL</label>
                <input id={`${dialogId}-posting-url`} type="url" value={jobPostingUrl} onChange={(e) => setJobPostingUrl(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <label htmlFor={`${dialogId}-posting-id`} className={labelClass}>Job ID</label>
                <input id={`${dialogId}-posting-id`} type="text" value={jobPostingId} onChange={(e) => setJobPostingId(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <label htmlFor={`${dialogId}-deadline`} className={labelClass}>Application deadline</label>
                <input id={`${dialogId}-deadline`} type="date" value={applicationDeadline} onChange={(e) => setApplicationDeadline(e.target.value)} className={fieldClass} />
              </div>
            </div>
          </details>
        </section>

        {/* STEP 2: Prompt Mode, Language & Salary */}
        <section className={stepBoxClass} aria-label="Step 2: Core settings">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-300 block">2. Prompt mode, language & preferences</span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor={`${dialogId}-mode`} className={labelClass}>Prompt mode</label>
              <select
                id={`${dialogId}-mode`}
                value={promptMode}
                onChange={(e) => setPromptMode(e.target.value as PromptMode)}
                className={`${fieldClass} cursor-pointer`}
              >
                <option value="full_application">Full application (CV + Cover Letter + Strategy)</option>
                <option value="triage_only">Quick triage (fit check before drafting · 30s)</option>
                <option value="outreach_only">Outreach messages & portal Q&A</option>
                <option value="interview_prep">STAR interview prep only (from your CV)</option>
              </select>
              {promptMode === "full_application" && (
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeInterviewPrep}
                    onChange={(e) => setIncludeInterviewPrep(e.target.checked)}
                    className="rounded border-slate-600"
                  />
                  Include STAR interview guide in the same JSON (+4 KB; by default generated separately after finalizing CV)
                </label>
              )}
            </div>

            <div>
              <label htmlFor={`${dialogId}-language`} className={labelClass}>Document language</label>
              <select
                id={`${dialogId}-language`}
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value as PromptBuilderOptions["targetLanguage"])}
                className={`${fieldClass} cursor-pointer`}
              >
                {LANGUAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {showGermanAddressing && (
              <div>
                <label htmlFor={`${dialogId}-addressing`} className={labelClass}>German addressing (Sie / Du)</label>
                <select
                  id={`${dialogId}-addressing`}
                  value={addressingMode}
                  onChange={(e) => setAddressingMode(e.target.value as AddressingMode)}
                  className={`${fieldClass} cursor-pointer`}
                >
                  <option value="auto">Auto (formal Sie by default)</option>
                  <option value="sie">Formal (Sie · Sehr geehrte...)</option>
                  <option value="du">Informal (Du · Hallo...)</option>
                </select>
              </div>
            )}

            <div>
              <label htmlFor={`${dialogId}-salary-hint`} className={labelClass}>Salary expectation if requested (optional)</label>
              <input
                id={`${dialogId}-salary-hint`}
                type="text"
                value={salaryExpectationHint}
                onChange={(e) => setSalaryExpectationHint(e.target.value)}
                placeholder="e.g., $85,000–$100,000 or €60,000–€70,000"
                className={fieldClass}
              />
            </div>
          </div>
        </section>

        {/* STEP 3: Fine-tuning (Collapsible) */}
        <details className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-inset)]/70 p-4 mb-4" open={emphasisHighlights.length > 0 || Boolean(customInstructions.trim() || screeningQuestionsText.trim())}>
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-blue-300">
            3. Fine-tuning (angle, {emphasisHighlights.length} selected, instructions & screening questions)
          </summary>

          <div className="mt-3.5 space-y-4">
            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3.5 ${!isCvTailoringMode ? "opacity-55" : ""}`}>
              <div>
                <label htmlFor={`${dialogId}-angle`} className={labelClass}>Positioning angle</label>
                <select
                  id={`${dialogId}-angle`}
                  value={strategyAngle}
                  disabled={!isCvTailoringMode}
                  onChange={(e) => setStrategyAngle(e.target.value as StrategyAngle)}
                  className={`${fieldClass} cursor-pointer`}
                >
                  {ANGLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${dialogId}-tone`} className={labelClass}>Writing tone</label>
                <select
                  id={`${dialogId}-tone`}
                  value={tonePreset}
                  disabled={!isCvTailoringMode}
                  onChange={(e) => setTonePreset(e.target.value as TonePreset)}
                  className={`${fieldClass} cursor-pointer`}
                >
                  {TONE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${dialogId}-length`} className={labelClass}>Target CV length</label>
                <select
                  id={`${dialogId}-length`}
                  value={cvLengthMode}
                  disabled={!isCvTailoringMode}
                  onChange={(e) => setCvLengthMode(e.target.value as CvLengthMode)}
                  className={`${fieldClass} cursor-pointer`}
                >
                  {LENGTH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {isCvTailoringMode && (
              <div className="ui-inset p-3.5 rounded-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    Evidence emphasis ({emphasisHighlights.length} selected)
                  </span>
                  {highlightOptions.length > 0 && (
                    <div className="flex gap-2">
                      <button type="button" onClick={selectAllHighlights} className="ui-button ui-button--secondary text-xs">
                        Select all
                      </button>
                      <button type="button" onClick={clearHighlights} className="ui-button ui-button--quiet text-xs">
                        Clear selection
                      </button>
                    </div>
                  )}
                </div>
                {highlightOptions.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Add key achievements to your <strong className="text-slate-200">Master CV</strong> to prioritize specific evidence highlights here. Without selections, the job posting determines which Master CV evidence is emphasized.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-slate-400 mb-3">
                      Without selections, the job posting determines which Master CV achievements are prioritized.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {highlightOptions.map((option) => {
                        const isSelected = emphasisHighlights.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => toggleHighlight(option.id)}
                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${
                              isSelected
                                ? "bg-[#10233f] border-blue-400/50 text-white"
                                : "bg-[var(--ui-panel)] border-[var(--ui-border)] text-slate-300 hover:border-slate-500/40 hover:text-white"
                            }`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                            )}
                            <span className="text-xs leading-relaxed font-medium">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor={`${dialogId}-instructions`} className={labelClass}>
                  Additional instructions (optional)
                </label>
                <input
                  id={`${dialogId}-instructions`}
                  type="text"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g., highlight cross-functional delivery experience relevant to this team."
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor={`${dialogId}-screening`} className={labelClass}>
                  Portal / screening questions (one per line)
                </label>
                <textarea
                  id={`${dialogId}-screening`}
                  rows={2}
                  value={screeningQuestionsText}
                  onChange={(e) => setScreeningQuestionsText(e.target.value)}
                  placeholder="e.g., Describe a complex project delivered with multiple stakeholders..."
                  className={`${fieldClass} resize-y`}
                />
              </div>
            </div>
          </div>
        </details>

        {/* Collapsible Prompt Preview */}
        <div className="ui-inset rounded-xl mb-5">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            aria-expanded={showPreview}
            className="ui-button ui-button--quiet w-full justify-between px-4 py-2.5 text-xs font-semibold text-blue-200"
          >
            <span>
              Prompt preview ({prompt.length.toLocaleString("en-US")} characters)
            </span>
            {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showPreview && (
            <pre className="px-4 pb-4 max-h-64 overflow-auto text-xs leading-relaxed text-slate-300 whitespace-pre-wrap font-mono">
              {prompt}
            </pre>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className="ui-button ui-button--secondary">
            Close
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!jobDescription.trim() || masterCvSyncStatus === "loading"}
            className={`ui-button px-5 font-semibold text-sm ${
              copied
                ? "bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-600"
                : "ui-button--primary"
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Prompt copied" : "Copy prompt"}
          </button>
        </div>
        {copyFailed && (
          <div className="mt-3" role="alert">
            <label htmlFor={`${dialogId}-manual-copy`} className="text-xs text-amber-200 block mb-1">
              Your browser blocked clipboard access. Select this exact text and copy it with Ctrl+C. Prompt provenance is not saved until copying succeeds.
            </label>
            <textarea id={`${dialogId}-manual-copy`} readOnly value={prompt} rows={5} onFocus={(event) => event.currentTarget.select()} className="w-full rounded border border-amber-500/40 bg-[var(--ui-inset)] p-2 text-xs text-white font-mono" />
          </div>
        )}
      </div>
    </div>
  );
}
