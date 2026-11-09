"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Copy, Check, X, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { buildExpertCommitteePrompt, type PromptBuilderOptions } from "../lib/promptBuilder";
import { MasterCv } from "../lib/schemas";

interface PromptGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateProfile?: MasterCv | null;
}

const LANGUAGE_OPTIONS: { value: PromptBuilderOptions["targetLanguage"]; label: string }[] = [
  { value: "auto", label: "Auto (Detect from Job Posting)" },
  { value: "English", label: "English" },
  { value: "German", label: "Deutsch" },
  { value: "Spanish", label: "Español" },
];

const ANGLE_OPTIONS: { value: PromptBuilderOptions["strategyAngle"]; label: string }[] = [
  { value: "auto", label: "Auto (Autonomous AI Committee Strategy)" },
  { value: "process_operations", label: "Processes & Operations (BPA, KPIs, SOPs)" },
  { value: "technical_automation", label: "Technical Automation & Integrations (APIs, Python, Workflows)" },
  { value: "quality_governance", label: "Quality, Governance & Compliance" },
  { value: "leadership_growth", label: "Cross-Functional Coordination & Service Delivery" },
];

export default function PromptGeneratorModal({ isOpen, onClose, candidateProfile: initialProfile }: PromptGeneratorModalProps) {
  const [profile, setProfile] = useState<MasterCv | null>(initialProfile || null);
  const [targetLanguage, setTargetLanguage] = useState<PromptBuilderOptions["targetLanguage"]>("auto");
  const [strategyAngle, setStrategyAngle] = useState<PromptBuilderOptions["strategyAngle"]>("auto");
  const [companyHint, setCompanyHint] = useState("");
  const [roleTitleHint, setRoleTitleHint] = useState("");
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

  const prompt = useMemo(
    () =>
      buildExpertCommitteePrompt({
        targetLanguage,
        strategyAngle,
        companyHint: companyHint.trim() || undefined,
        roleTitleHint: roleTitleHint.trim() || undefined,
        jobDescription,
        candidateProfile: profile || undefined,
      }),
    [targetLanguage, strategyAngle, companyHint, roleTitleHint, jobDescription, profile]
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
    "w-full px-3 py-2 rounded-xl bg-[#0a0f1d] border border-[#1f2937] text-white focus:outline-none focus:border-[#6d8ead] transition-colors text-sm";
  const labelClass = "text-[10px] uppercase font-bold text-[#6d8ead] mb-1 block tracking-wider";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-[#1f2937] bg-[#0e162d] p-6 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#10233f] transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#6d8ead]" />
          Job Application AI Master Prompt Generator
        </h3>
        <p className="text-xs text-[#6b7280] mb-5 max-w-xl">
          Paste the job description, copy the optimized multi-expert prompt, and paste it into ChatGPT, Claude, or Gemini.
          Then import the resulting JSON via <strong className="text-slate-300">New Application → Import JSON</strong>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass}>Document Language</label>
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
            <label className={labelClass}>Strategic Angle</label>
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
            <label className={labelClass}>Target Company (Optional)</label>
            <input
              type="text"
              value={companyHint}
              onChange={(e) => setCompanyHint(e.target.value)}
              placeholder="Extracted automatically from posting if blank"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Role Title (Optional)</label>
            <input
              type="text"
              value={roleTitleHint}
              onChange={(e) => setRoleTitleHint(e.target.value)}
              placeholder="Extracted automatically from posting if blank"
              className={fieldClass}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className={labelClass}>Job Description (Optional, or paste directly into the LLM chat)</label>
          <textarea
            rows={6}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job posting text here..."
            className="w-full p-3 rounded-xl bg-[#0a0f1d] border border-[#1f2937] text-white text-xs font-mono focus:border-[#6d8ead] outline-none leading-normal resize-y"
          />
        </div>

        <div className="rounded-xl border border-[#1f2937] bg-[#0a0f1d]/70 mb-5">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-[#6d8ead] hover:text-white transition-colors"
          >
            <span>
              Prompt Preview ({prompt.length.toLocaleString()} characters)
            </span>
            {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showPreview && (
            <pre className="px-4 pb-4 max-h-72 overflow-auto text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap font-mono">
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
            {copied ? "Copied!" : "Copy Prompt"}
          </button>
        </div>
      </div>
    </div>
  );
}
