"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Copy, Check, X, Sparkles, ChevronDown, ChevronUp, Sliders, Award, MessageSquarePlus } from "lucide-react";
import {
  buildExpertCommitteePrompt,
  EMPHASIS_HIGHLIGHT_CATALOG,
  type EmphasisHighlightId,
  type PromptBuilderOptions,
} from "../lib/promptBuilder";
import { MasterCv } from "../lib/schemas";

interface PromptGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCompany?: string;
  initialRoleTitle?: string;
  initialLanguage?: "English" | "German" | "Spanish";
  candidateProfile?: MasterCv | null;
}

const LANGUAGE_OPTIONS: { value: PromptBuilderOptions["targetLanguage"]; label: string }[] = [
  { value: "auto", label: "Auto (Detect from Job Description)" },
  { value: "English", label: "English" },
  { value: "German", label: "Deutsch (DACH)" },
  { value: "Spanish", label: "Español" },
];

const ANGLE_OPTIONS: { value: PromptBuilderOptions["strategyAngle"]; label: string }[] = [
  { value: "auto", label: "🤖 Auto-Detect Best Angle (5-Expert Committee)" },
  { value: "ai_agents_automation", label: "⚡ AI Agents, LLM Orchestration & n8n/Make Automation" },
  { value: "process_operations", label: "📐 Business Process Analyst, BPMN 2.0 & Operational Excellence" },
  { value: "business_steering_six_sigma", label: "📊 Business Steering, Lean Six Sigma & KPI Governance" },
  { value: "technical_operations_jira", label: "🔧 Technical Operations, Jira/CRM & Incident Bridging" },
  { value: "quality_governance", label: "⚖️ EU AI Act, Regulatory Compliance & Risk Governance" },
  { value: "leadership_growth", label: "🚀 Operations Leadership, Scaling & Cross-Functional Delivery" },
];

const TONE_OPTIONS: { value: NonNullable<PromptBuilderOptions["tonePreset"]>; label: string }[] = [
  { value: "auto", label: "Auto-Calibrate to Company Type" },
  { value: "hands_on_builder", label: "Hands-On Builder & Technical Operator (Pipelines, APIs, Shipping)" },
  { value: "internal_consultant", label: "Internal Consultant & Process Architect (Advisory, Discovery, SOPs)" },
  { value: "executive_operator", label: "Executive Operations & Strategic Steering (Scale, SLAs, ROI)" },
];

const LENGTH_OPTIONS: { value: NonNullable<PromptBuilderOptions["cvLengthMode"]>; label: string }[] = [
  { value: "standard_2page", label: "Executive 2-Page (360–440 words · Recommended)" },
  { value: "compact_1page", label: "Ultra-Compact 1-Page (280–340 words · Startup / Fast Scan)" },
  { value: "comprehensive", label: "Comprehensive Technical (420–480 words · Deep Senior Roles)" },
];

export default function PromptGeneratorModal({
  isOpen,
  onClose,
  initialCompany = "",
  initialRoleTitle = "",
  initialLanguage,
  candidateProfile: initialProfile,
}: PromptGeneratorModalProps) {
  const [profile, setProfile] = useState<MasterCv | null>(initialProfile || null);
  const [targetLanguage, setTargetLanguage] = useState<PromptBuilderOptions["targetLanguage"]>(
    initialLanguage || "auto"
  );
  const [strategyAngle, setStrategyAngle] = useState<PromptBuilderOptions["strategyAngle"]>("auto");
  const [tonePreset, setTonePreset] = useState<NonNullable<PromptBuilderOptions["tonePreset"]>>("auto");
  const [cvLengthMode, setCvLengthMode] = useState<NonNullable<PromptBuilderOptions["cvLengthMode"]>>("standard_2page");
  const [emphasisHighlights, setEmphasisHighlights] = useState<EmphasisHighlightId[]>([
    "ai-agents-rag",
    "process-sops-bpmn",
    "n8n-make-orchestration",
  ]);
  const [customInstructions, setCustomInstructions] = useState("");
  const [companyHint, setCompanyHint] = useState(initialCompany);
  const [roleTitleHint, setRoleTitleHint] = useState(initialRoleTitle);
  const [jobDescription, setJobDescription] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      return;
    }
    if (isOpen && !profile) {
      fetch("/api/master-cv")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setProfile(data);
        })
        .catch(() => {});
    }
  }, [isOpen, initialProfile, profile]);

  const toggleHighlight = (id: EmphasisHighlightId) => {
    setEmphasisHighlights((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllHighlights = () => {
    setEmphasisHighlights(EMPHASIS_HIGHLIGHT_CATALOG.map((h) => h.id));
  };

  const clearHighlights = () => {
    setEmphasisHighlights([]);
  };

  const prompt = useMemo(
    () =>
      buildExpertCommitteePrompt({
        targetLanguage,
        strategyAngle,
        tonePreset,
        cvLengthMode,
        emphasisHighlights,
        customInstructions: customInstructions.trim() || undefined,
        companyHint: companyHint.trim() || undefined,
        roleTitleHint: roleTitleHint.trim() || undefined,
        jobDescription,
        candidateProfile: profile || undefined,
      }),
    [
      targetLanguage,
      strategyAngle,
      tonePreset,
      cvLengthMode,
      emphasisHighlights,
      customInstructions,
      companyHint,
      roleTitleHint,
      jobDescription,
      profile,
    ]
  );

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = prompt;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const fieldClass =
    "w-full px-3 py-2 rounded-xl bg-[#0a0f1d] border border-[#1f2937] text-white focus:outline-none focus:border-[#6d8ead] transition-colors text-xs";
  const labelClass = "text-[10px] uppercase font-bold text-[#6d8ead] mb-1 block tracking-wider";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[93vh] overflow-y-auto rounded-2xl border border-[#1f2937] bg-[#0e162d] p-6 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#10233f] transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-[#6d8ead]" />
          <h3 className="text-lg font-bold text-white">
            AI Master Prompt Studio (5-Expert Committee Engine)
          </h3>
        </div>
        <p className="text-xs text-[#6b7280] mb-5 max-w-2xl">
          Customize how the 5-Expert Hiring Committee builds your tailored application JSON. Select your strategic angle, tone, density, and priority career achievements, then paste the generated prompt into Gemini, Claude, or ChatGPT.
        </p>

        {/* Row 1: Core Strategy & Language */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
          <div>
            <label className={labelClass}>1. Output Language</label>
            <select
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

          <div>
            <label className={labelClass}>2. Primary Positioning Angle</label>
            <select
              value={strategyAngle}
              onChange={(e) => setStrategyAngle(e.target.value as PromptBuilderOptions["strategyAngle"])}
              className={`${fieldClass} cursor-pointer`}
            >
              {ANGLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1">
                <Sliders className="w-3 h-3" /> 3. Seniority & Tone Calibration
              </span>
            </label>
            <select
              value={tonePreset}
              onChange={(e) => setTonePreset(e.target.value as NonNullable<PromptBuilderOptions["tonePreset"]>)}
              className={`${fieldClass} cursor-pointer`}
            >
              {TONE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>4. Target CV Density</label>
            <select
              value={cvLengthMode}
              onChange={(e) => setCvLengthMode(e.target.value as NonNullable<PromptBuilderOptions["cvLengthMode"]>)}
              className={`${fieldClass} cursor-pointer`}
            >
              {LENGTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Target Company (Optional)</label>
            <input
              type="text"
              value={companyHint}
              onChange={(e) => setCompanyHint(e.target.value)}
              placeholder="Auto-extracted from Job Description if left blank"
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass}>Target Role Title (Optional)</label>
            <input
              type="text"
              value={roleTitleHint}
              onChange={(e) => setRoleTitleHint(e.target.value)}
              placeholder="Auto-extracted from Job Description if left blank"
              className={fieldClass}
            />
          </div>
        </div>

        {/* Row 2: Interactive Career Highlights Selector */}
        <div className="mb-4 rounded-xl border border-[#1f2937] bg-[#0a0f1d]/80 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <label className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              5. Priority Career Highlights & Competencies ({emphasisHighlights.length} active)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllHighlights}
                className="text-[10px] font-semibold text-[#6d8ead] hover:text-white transition-colors"
              >
                Select All
              </button>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={clearHighlights}
                className="text-[10px] font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mb-2.5">
            Select 2 to 5 core milestones that best match this job offer so the LLM prioritizes them in your Profile, Key Achievements, and Cover Letter:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {EMPHASIS_HIGHLIGHT_CATALOG.map((item) => {
              const active = emphasisHighlights.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleHighlight(item.id)}
                  className={`text-left px-3 py-2 rounded-lg border text-xs transition-all flex items-start gap-2 ${
                    active
                      ? "bg-[#10233f] border-[#6d8ead] text-white shadow-sm"
                      : "bg-[#0e162d]/50 border-[#1f2937] text-slate-400 hover:text-slate-200 hover:border-slate-700"
                  }`}
                >
                  <span
                    className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${
                      active ? "bg-emerald-500 text-black" : "border border-slate-600 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className="leading-snug">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Custom Instructions / Special Notes */}
        <div className="mb-4">
          <label className={labelClass}>
            <span className="inline-flex items-center gap-1">
              <MessageSquarePlus className="w-3 h-3" /> 6. Custom Instructions / Context Override (Optional)
            </span>
          </label>
          <input
            type="text"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="e.g. Emphasize B2B SaaS onboarding, logistics partners, or address a specific requirement..."
            className={fieldClass}
          />
        </div>

        {/* Row 4: Job Description */}
        <div className="mb-4">
          <label className={labelClass}>7. Job Description (Paste here or directly in the LLM chat)</label>
          <textarea
            rows={5}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here so the prompt is 100% ready to copy and send..."
            className="w-full p-3 rounded-xl bg-[#0a0f1d] border border-[#1f2937] text-white text-xs font-mono focus:border-[#6d8ead] outline-none leading-normal resize-y"
          />
        </div>

        {/* Row 5: Live Prompt Preview */}
        <div className="rounded-xl border border-[#1f2937] bg-[#0a0f1d]/70 mb-5">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-[#6d8ead] hover:text-white transition-colors"
          >
            <span>
              View Full Generated Prompt ({prompt.length.toLocaleString()} characters · Master CV + {emphasisHighlights.length} priority highlights)
            </span>
            {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showPreview && (
            <pre className="px-4 pb-4 max-h-64 overflow-auto text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap font-mono">
              {prompt}
            </pre>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#10233f]/50 hover:bg-[#10233f] text-[#6d8ead] border border-[#6d8ead]/10 font-semibold text-sm transition-all"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={`px-5 py-2 rounded-xl font-semibold text-sm shadow-md transition-all active:scale-95 flex items-center gap-2 text-white ${
              copied
                ? "bg-emerald-600 hover:bg-emerald-600"
                : "bg-gradient-to-r from-[#10233f] to-[#1d3d6b] hover:from-[#152d50] hover:to-[#244e88]"
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Prompt Copied!" : "Copy Personalized Prompt"}
          </button>
        </div>
      </div>
    </div>
  );
}
