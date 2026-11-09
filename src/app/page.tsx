"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Briefcase, FileText, Trash2, Edit3, Image as ImageIcon, CheckCircle, Download, FileUp, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";
import SignaturePad from "../components/SignaturePad";
import PromptGeneratorModal from "../components/PromptGeneratorModal";

interface Application {
  id: string;
  company: string;
  roleTitle: string;
  dateCreated: string;
  dateModified: string;
  status: string;
  language: string;
  notes?: string;
  interviewDate?: string;
  recruiterContact?: string;
  salaryOffer?: string;
}

interface MasterCvSummary {
  fullName: string;
  location: string;
  email: string;
  languages: { language: string; level: string }[];
}

export default function Dashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [masterCv, setMasterCv] = useState<MasterCvSummary | null>(null);
  const [loading, setLoading] = useState(true);
  
  // New App Form State
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [importMode, setImportMode] = useState<"manual" | "json">("manual");
  const [jsonText, setJsonText] = useState("");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [language, setLanguage] = useState("English");
  const [creating, setCreating] = useState(false);

  // Validation Summary State for AI JSON
  const [validationSummary, setValidationSummary] = useState<{
    valid: boolean;
    company?: string;
    roleTitle?: string;
    fitScore?: number | null;
    priority?: string;
    positioning?: string;
    errors?: string[];
  } | null>(null);

  useEffect(() => {
    if (importMode !== "json" || !jsonText.trim()) {
      setValidationSummary(null);
      return;
    }

    try {
      const parsed = JSON.parse(jsonText);
      const errors: string[] = [];
      const comp = parsed.company || parsed.cvContent?.header?.company || "";
      const role = parsed.roleTitle || parsed.cvContent?.header?.headline || "";
      
      const fitObj = parsed.fitAssessment || parsed.fit || parsed.fitScore;
      const fitScore = fitObj?.scoreOutOf10 !== undefined ? fitObj.scoreOutOf10 : null;
      
      const classObj = parsed.roleClassification || parsed.classification;
      const priority = classObj?.applicationPriority || "";
      const positioning = classObj?.recommendedPositioning || "";

      if (!comp) errors.push("Missing 'company' name.");
      if (!role) errors.push("Missing 'roleTitle' (position).");

      setValidationSummary({
        valid: errors.length === 0,
        company: comp,
        roleTitle: role,
        fitScore,
        priority,
        positioning,
        errors
      });
    } catch (err: any) {
      setValidationSummary({
        valid: false,
        errors: ["JSON Syntax Error: " + err.message]
      });
    }
  }, [jsonText, importMode]);

  // Asset Upload States
  const [sigUploading, setSigUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [uploadedSigUrl, setUploadedSigUrl] = useState<string | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [sigEnabled, setSigEnabled] = useState(false);
  const [photoEnabled, setPhotoEnabled] = useState(false);
  const [showSigPad, setShowSigPad] = useState(false);

  // Load dashboard data
  useEffect(() => {
    async function fetchData() {
      try {
        const appsRes = await fetch("/api/applications");
        const appsData = await appsRes.json();
        setApplications(appsData);

        const cvRes = await fetch("/api/master-cv");
        const cvData = await cvRes.json();
        setMasterCv({
          fullName: cvData.fullName,
          location: cvData.location,
          email: cvData.email,
          languages: cvData.languages || []
        });

        // Also fetch general settings to set sig/photo status
        if (cvData) {
          // Check local storage or default state for assets
          const savedSig = localStorage.getItem("asr_default_sig");
          const savedPhoto = localStorage.getItem("asr_default_photo");
          if (savedSig) setUploadedSigUrl(savedSig);
          if (savedPhoto) setUploadedPhotoUrl(savedPhoto);
          setSigEnabled(localStorage.getItem("asr_sig_enabled") === "true");
          setPhotoEnabled(localStorage.getItem("asr_photo_enabled") === "true");
        }
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Handle create new application
  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let targetCompany = company;
    let targetRoleTitle = roleTitle;
    let targetLanguage = language;

    if (importMode === "json") {
      if (!jsonText.trim()) {
        alert("Por favor, introduce el contenido JSON.");
        return;
      }
      try {
        const parsedJson = JSON.parse(jsonText);
        targetCompany = parsedJson.company || "Generic";
        targetRoleTitle = parsedJson.roleTitle || "Role";
      } catch (err: any) {
        alert("El contenido JSON no es válido: " + err.message);
        return;
      }
    } else {
      if (!company.trim() || !roleTitle.trim()) return;
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
          pastedJson: importMode === "json" ? jsonText : undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create application");
      }
      const newApp = await res.json();
      
      // Update local state for assets to pre-configure signature/photo if they are enabled globally
      let needsPut = false;
      if (uploadedSigUrl && sigEnabled) {
        newApp.assetSettings.signature.enabled = true;
        newApp.assetSettings.signature.filePath = uploadedSigUrl;
        needsPut = true;
      }
      if (uploadedPhotoUrl && photoEnabled) {
        newApp.assetSettings.photo.enabled = true;
        newApp.assetSettings.photo.filePath = uploadedPhotoUrl;
        needsPut = true;
      }

      if (needsPut) {
        // Save updated app settings back to the server
        await fetch(`/api/applications/${newApp.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newApp)
        });
      }

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });

      // Redirect to the editor page
      window.location.href = `/applications/${newApp.id}`;
    } catch (err: any) {
      console.error(err);
      alert("Error creating application draft: " + err.message);
      setCreating(false);
    }
  };

  // Handle Delete Application
  const handleDeleteApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this application?")) return;

    try {
      const res = await fetch(`/api/applications/${id}`, { method: "DELETE" });
      if (res.ok) {
        setApplications(apps => apps.filter(a => a.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Asset Upload handler
  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "signature" | "photo") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const setUploading = type === "signature" ? setSigUploading : setPhotoUploading;
    const setUrl = type === "signature" ? setUploadedSigUrl : setUploadedPhotoUrl;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setUrl(data.url);
        localStorage.setItem(`asr_default_${type}`, data.url);
        // Auto enable
        if (type === "signature") {
          setSigEnabled(true);
          localStorage.setItem("asr_sig_enabled", "true");
        } else {
          setPhotoEnabled(true);
          localStorage.setItem("asr_photo_enabled", "true");
        }
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading file.");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDrawnSignature = async (blob: Blob) => {
    setShowSigPad(false);
    setSigUploading(true);

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
        setUploadedSigUrl(data.url);
        localStorage.setItem("asr_default_sig", data.url);
        setSigEnabled(true);
        localStorage.setItem("asr_sig_enabled", "true");
        
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
      setSigUploading(false);
    }
  };

  const toggleSigStatus = () => {
    const nextVal = !sigEnabled;
    setSigEnabled(nextVal);
    localStorage.setItem("asr_sig_enabled", String(nextVal));
  };

  const togglePhotoStatus = () => {
    const nextVal = !photoEnabled;
    setPhotoEnabled(nextVal);
    localStorage.setItem("asr_photo_enabled", String(nextVal));
  };

  // Statistics computation
  const totalCount = applications.length;
  const draftCount = applications.filter(a => a.status === "draft").length;
  const appliedCount = applications.filter(a => a.status === "applied").length;
  const interviewingCount = applications.filter(a => a.status === "interviewing").length;
  const offeredCount = applications.filter(a => a.status === "offered").length;
  const rejectedCount = applications.filter(a => a.status === "rejected").length;
  const archivedCount = applications.filter(a => a.status === "archived").length;

  const statsConfig = [
    { key: "all", label: "Total", count: totalCount, color: "border-[#6d8ead] text-white", bg: "bg-[#6d8ead]/25" },
    { key: "draft", label: "Borradores", count: draftCount, color: "border-slate-400 text-slate-400", bg: "bg-slate-400/10" },
    { key: "applied", label: "Enviados", count: appliedCount, color: "border-blue-500 text-blue-400", bg: "bg-blue-500/10" },
    { key: "interviewing", label: "Entrevistas", count: interviewingCount, color: "border-amber-500 text-amber-400", bg: "bg-amber-500/10" },
    { key: "offered", label: "Ofertas", count: offeredCount, color: "border-emerald-500 text-emerald-400", bg: "bg-emerald-500/10" },
    { key: "rejected", label: "Rechazados", count: rejectedCount, color: "border-rose-500 text-rose-400", bg: "bg-rose-500/10" },
    { key: "archived", label: "Archivados", count: archivedCount, color: "border-gray-700 text-gray-500", bg: "bg-gray-700/10" },
  ];

  const filteredApps = applications.filter(app => {
    if (statusFilter === "all") return true;
    return app.status === statusFilter;
  });

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "draft":
        return {
          border: "border-l-slate-500 hover:border-l-slate-400",
          bg: "bg-slate-500/10 text-slate-300 border-slate-500/30",
          label: "Borrador",
        };
      case "applied":
        return {
          border: "border-l-blue-500 hover:border-l-blue-400",
          bg: "bg-blue-500/10 text-blue-400 border-blue-500/30",
          label: "Enviado",
        };
      case "interviewing":
        return {
          border: "border-l-amber-500 hover:border-l-amber-400",
          bg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          label: "Entrevista",
        };
      case "offered":
        return {
          border: "border-l-emerald-500 hover:border-l-emerald-400",
          bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          label: "Ofrecido",
        };
      case "rejected":
        return {
          border: "border-l-rose-500 hover:border-l-rose-400",
          bg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
          label: "Rechazado",
        };
      case "archived":
        return {
          border: "border-l-gray-700 hover:border-l-gray-600",
          bg: "bg-gray-700/15 text-gray-400 border-gray-700/30",
          label: "Archivado",
        };
      default:
        return {
          border: "border-l-slate-500 hover:border-l-slate-400",
          bg: "bg-slate-500/10 text-slate-300 border-slate-500/30",
          label: status || "Borrador",
        };
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#0a0f1d] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6d8ead]"></div>
        <p className="mt-4 text-[#6d8ead]">Loading workspace data...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#0a0f1d] text-[#ededed] font-sans selection:bg-[#6d8ead] selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-[#1f2937]/60 bg-[#0c1328]/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#10233f] to-[#6d8ead] flex items-center justify-center font-bold text-lg border border-[#6d8ead]/30 shadow-lg shadow-[#6d8ead]/10">
            ASR
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Application Builder</h1>
            <p className="text-xs text-[#6d8ead]">Premium Local Document Compiler</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPromptModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#10233f]/50 hover:bg-[#10233f] text-[#6d8ead] hover:text-white font-medium transition-all duration-300 border border-[#6d8ead]/30 active:scale-95"
          >
            <Sparkles className="w-4 h-4" /> Prompt IA
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#10233f] to-[#1d3d6b] hover:from-[#152d50] hover:to-[#244e88] text-white font-medium shadow-lg shadow-[#10233f]/40 transition-all duration-300 transform hover:-translate-y-0.5 border border-[#6d8ead]/20 active:scale-95"
          >
            <Plus className="w-4 h-4" /> New Application
          </button>
        </div>
      </header>

      {/* Global Status Stats Banner */}
      <section className="max-w-7xl mx-auto px-6 pt-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {statsConfig.map((stat) => (
            <button
              key={stat.key}
              onClick={() => setStatusFilter(stat.key)}
              className={`rounded-2xl border p-4 flex flex-col justify-between text-left transition-all duration-300 cursor-pointer shadow-lg backdrop-blur-md relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] ${
                statusFilter === stat.key
                  ? `bg-[#0e162d] ${stat.color} border-2 shadow-2xl`
                  : `bg-[#0e162d]/60 border-[#1f2937]/80 hover:border-[#6d8ead]/40`
              }`}
            >
              <div className={`absolute top-0 right-0 w-12 h-12 rounded-full blur-xl opacity-20 ${stat.bg}`}></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                {stat.label}
              </span>
              <span className="text-3xl font-black mt-2 text-white block">
                {stat.count}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Main Grid Layout */}
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Master Profiles & Global Uploads */}
        <section className="lg:col-span-1 space-y-8">
          
          {/* Master CV Card */}
          <div className="rounded-2xl border border-[#1f2937]/80 bg-[#0e162d]/90 p-6 shadow-xl backdrop-blur-lg relative overflow-hidden group">
            <div className="absolute -right-16 -top-16 w-32 h-32 bg-[#6d8ead]/10 rounded-full blur-2xl group-hover:bg-[#6d8ead]/15 transition-all duration-500"></div>
            
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#6d8ead]" />
                <h3 className="text-lg font-bold text-white">Master CV</h3>
              </div>
              <Link
                href="/master-cv"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#10233f] hover:bg-[#152e52] text-[#6d8ead] border border-[#6d8ead]/30 transition-all duration-200"
              >
                Edit Master
              </Link>
            </div>

            {masterCv ? (
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">{masterCv.fullName}</h4>
                  <p className="text-xs text-[#6b7280]">{masterCv.location}</p>
                </div>
                
                <div className="border-t border-[#1f2937] pt-3">
                  <span className="text-[11px] uppercase tracking-wider text-[#6d8ead] block mb-1">Active Languages</span>
                  <div className="flex flex-wrap gap-1.5">
                    {masterCv.languages.map((l, i) => (
                      <span key={i} className="text-[10px] bg-[#10233f]/60 px-2 py-0.5 rounded border border-[#6d8ead]/10 text-slate-300">
                        {l.language} ({l.level})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#6b7280]">No Master CV initialized.</p>
            )}
          </div>

          {/* Global Asset Uploads (Signature & Photo) */}
          <div className="rounded-2xl border border-[#1f2937]/80 bg-[#0e162d]/90 p-6 shadow-xl backdrop-blur-lg space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-[#1f2937]">
              <ImageIcon className="w-5 h-5 text-[#6d8ead]" />
              <h3 className="text-lg font-bold text-white">Default Assets</h3>
            </div>

            {/* Photo Asset */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Profile Photo</span>
                  <span className="text-[10px] text-[#6b7280]">Used in Modern CV templates</span>
                </div>
                <input
                  type="checkbox"
                  checked={photoEnabled}
                  onChange={togglePhotoStatus}
                  className="w-4 h-4 rounded border-[#1f2937] text-[#6d8ead] focus:ring-[#6d8ead] accent-[#6d8ead] cursor-pointer"
                  disabled={!uploadedPhotoUrl}
                />
              </div>

              {uploadedPhotoUrl ? (
                <div className="flex items-center gap-3 bg-[#0a0f1d] p-2.5 rounded-xl border border-[#1f2937]/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={uploadedPhotoUrl} alt="Preview" className="w-10 h-10 rounded-full object-cover border border-[#6d8ead]/30" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#6d8ead] truncate">Uploaded Photo</p>
                    <p className="text-[9px] text-[#6b7280]">{photoEnabled ? "Enabled by default" : "Disabled by default"}</p>
                  </div>
                  <label className="cursor-pointer text-[10px] font-semibold text-[#6d8ead] hover:underline">
                    Replace
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAssetUpload(e, "photo")} />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#1f2937]/80 hover:border-[#6d8ead]/40 bg-[#0a0f1d]/50 hover:bg-[#0a0f1d]/80 rounded-xl p-4 cursor-pointer transition-all duration-300">
                  {photoUploading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#6d8ead]"></div>
                  ) : (
                    <>
                      <FileUp className="w-5 h-5 text-[#6d8ead] mb-1.5" />
                      <span className="text-xs text-[#6d8ead] font-medium">Upload Profile Photo</span>
                      <span className="text-[9px] text-[#6b7280] mt-0.5">PNG, JPG up to 5MB</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAssetUpload(e, "photo")} />
                </label>
              )}
            </div>

            {/* Signature Asset */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Handwritten Signature</span>
                  <span className="text-[10px] text-[#6b7280]">Used in Cover Letter sidebar</span>
                </div>
                <input
                  type="checkbox"
                  checked={sigEnabled}
                  onChange={toggleSigStatus}
                  className="w-4 h-4 rounded border-[#1f2937] text-[#6d8ead] focus:ring-[#6d8ead] accent-[#6d8ead] cursor-pointer"
                  disabled={!uploadedSigUrl}
                />
              </div>

              {uploadedSigUrl ? (
                <div className="flex flex-col gap-2 bg-[#0a0f1d] p-3 rounded-xl border border-[#1f2937]/60">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-[#6d8ead]">Uploaded Signature</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowSigPad(true)} className="text-[10px] text-slate-400 hover:text-white font-semibold">Draw</button>
                      <label className="cursor-pointer text-[10px] font-semibold text-[#6d8ead] hover:underline">
                        Replace
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAssetUpload(e, "signature")} />
                      </label>
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg flex justify-center border border-[#1f2937]/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={uploadedSigUrl} alt="Signature Preview" className="h-10 w-auto object-contain" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#1f2937]/80 hover:border-[#6d8ead]/40 bg-[#0a0f1d]/50 hover:bg-[#0a0f1d]/80 rounded-xl p-4 cursor-pointer transition-all duration-300">
                    {sigUploading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#6d8ead]"></div>
                    ) : (
                      <>
                        <FileUp className="w-5 h-5 text-[#6d8ead] mb-1.5" />
                        <span className="text-xs text-[#6d8ead] font-medium">Upload Transparent Signature</span>
                        <span className="text-[9px] text-[#6b7280] mt-0.5">PNG, JPG (prefer transparency)</span>
                      </>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAssetUpload(e, "signature")} />
                  </label>
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
        </section>

        {/* Right Column: Applications Tracker List */}
        <section className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#6d8ead]" />
              Applications Dashboard {statusFilter !== "all" && <span className="text-[#6d8ead] font-medium text-sm">({statusFilter})</span>}
            </h3>
            <span className="text-xs text-[#6d8ead] font-semibold bg-[#10233f] px-2.5 py-1 rounded-full border border-[#6d8ead]/20">
              {filteredApps.length} shown / {applications.length} total
            </span>
          </div>

          {filteredApps.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredApps.map((app) => {
                const statusInfo = getStatusStyles(app.status);
                return (
                  <div
                    key={app.id}
                    onClick={() => window.location.href = `/applications/${app.id}`}
                    className={`rounded-2xl border border-[#1f2937]/80 bg-[#0e162d]/60 hover:bg-[#0e162d]/90 p-5 shadow-lg backdrop-blur-sm cursor-pointer transition-all duration-300 hover:shadow-[#6d8ead]/5 border-l-4 ${statusInfo.border} group flex flex-col justify-between h-48 relative overflow-hidden`}
                  >
                    <div className="absolute right-4 top-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                      <Briefcase className="w-24 h-24 text-white" />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d8ead] bg-[#10233f]/80 px-2 py-0.5 rounded border border-[#6d8ead]/10">
                            {app.language}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusInfo.bg}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(app.dateModified).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-white group-hover:text-[#6d8ead] transition-colors duration-200 truncate pr-4">
                        {app.roleTitle}
                      </h4>
                      <p className="text-xs text-[#6b7280] font-medium truncate mb-2">
                        {app.company}
                      </p>

                      {/* Compact extra metadata */}
                      <div className="flex flex-wrap gap-1.5 max-h-12 overflow-hidden">
                        {app.interviewDate && (
                          <span className="text-[9px] text-amber-300 font-semibold truncate bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            📅 {app.interviewDate}
                          </span>
                        )}
                        {app.salaryOffer && (
                          <span className="text-[9px] text-emerald-300 font-semibold truncate bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            💰 {app.salaryOffer}
                          </span>
                        )}
                        {app.recruiterContact && (
                          <span className="text-[9px] text-[#6d8ead] font-semibold truncate bg-[#10233f]/50 px-1.5 py-0.5 rounded border border-[#6d8ead]/20">
                            👤 {app.recruiterContact}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#1f2937]/60 z-10">
                      <span className="text-[10px] flex items-center gap-1 text-slate-400 font-semibold">
                        {app.status === "draft" && (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Listo para compilar
                          </span>
                        )}
                        {app.status === "applied" && (
                          <span className="text-blue-400 flex items-center gap-1">
                            📬 Enviado
                          </span>
                        )}
                        {app.status === "interviewing" && (
                          <span className="text-amber-400 flex items-center gap-1 font-bold">
                            🔥 Proceso activo
                          </span>
                        )}
                        {app.status === "offered" && (
                          <span className="text-emerald-400 flex items-center gap-1 font-black">
                            🎉 ¡Oferta recibida!
                          </span>
                        )}
                        {app.status === "rejected" && (
                          <span className="text-rose-400 flex items-center gap-1">
                            ❌ Rechazado
                          </span>
                        )}
                        {app.status === "archived" && (
                          <span className="text-slate-500 flex items-center gap-1">
                            📦 Archivado
                          </span>
                        )}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/applications/${app.id}`;
                          }}
                          title="Edit application"
                          className="p-1.5 rounded-lg bg-[#10233f] text-[#6d8ead] hover:bg-[#1a3862] hover:text-white border border-[#6d8ead]/20 transition-all duration-200 active:scale-95"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteApp(app.id, e)}
                          title="Delete application"
                          className="p-1.5 rounded-lg bg-[#1e1320] text-rose-400 hover:bg-rose-900/40 hover:text-rose-300 border border-rose-900/30 transition-all duration-200 active:scale-95"
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
            <div className="rounded-2xl border-2 border-dashed border-[#1f2937] bg-[#0e162d]/20 p-12 text-center">
              <Briefcase className="w-12 h-12 text-[#6b7280] mx-auto mb-4 opacity-50" />
              {applications.length === 0 ? (
                <>
                  <h4 className="text-white font-bold mb-1">No Applications Drafts Yet</h4>
                  <p className="text-xs text-[#6b7280] max-w-sm mx-auto mb-6">
                    Get started by clicking the "New Application" button to create your first customized document set.
                  </p>
                  <button
                    onClick={() => setShowNewModal(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#10233f] to-[#1d3d6b] text-white font-medium shadow-md hover:from-[#152d50] hover:to-[#244e88] transition-all"
                  >
                    Create First Draft
                  </button>
                </>
              ) : (
                <>
                  <h4 className="text-white font-bold mb-1">No hay solicitudes en esta sección</h4>
                  <p className="text-xs text-[#6b7280] max-w-sm mx-auto mb-6">
                    No se encontraron solicitudes con el filtro seleccionado.
                  </p>
                  <button
                    onClick={() => setStatusFilter("all")}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#10233f] to-[#1d3d6b] text-white font-medium shadow-md hover:from-[#152d50] hover:to-[#244e88] transition-all"
                  >
                    Mostrar todas las solicitudes
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      </main>

      {/* New Application Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1f2937] bg-[#0e162d] p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -left-16 -top-16 w-32 h-32 bg-[#6d8ead]/15 rounded-full blur-2xl"></div>
            
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#6d8ead]" />
              New Application Draft
            </h3>
            <p className="text-xs text-[#6b7280] mb-5">
              This will pre-fill a new document set using your Master CV.
            </p>

            {/* Mode Selector Tabs */}
            <div className="flex bg-[#0a0f1d] border border-[#1f2937]/80 rounded-xl p-0.5 mb-4 shrink-0">
              <button
                type="button"
                onClick={() => setImportMode("manual")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  importMode === "manual" ? "bg-[#10233f] text-[#6d8ead] border border-[#6d8ead]/20" : "text-slate-400 hover:text-white"
                }`}
              >
                Manual Entry
              </button>
              <button
                type="button"
                onClick={() => setImportMode("json")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  importMode === "json" ? "bg-[#10233f] text-[#6d8ead] border border-[#6d8ead]/20" : "text-slate-400 hover:text-white"
                }`}
              >
                Import JSON
              </button>
            </div>

            <form onSubmit={handleCreateApplication} className="space-y-4">
              {importMode === "manual" ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">Company Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Corp, CloudTech"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#0a0f1d] border border-[#1f2937] text-white focus:outline-none focus:border-[#6d8ead] transition-colors duration-200 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">Role Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Business Steering Analyst"
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#0a0f1d] border border-[#1f2937] text-white focus:outline-none focus:border-[#6d8ead] transition-colors duration-200 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">Target Language</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#0a0f1d] border border-[#1f2937] text-white focus:outline-none focus:border-[#6d8ead] transition-colors duration-200 text-sm cursor-pointer"
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="German">German</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowPromptModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-[#6d8ead]/30 bg-[#10233f]/40 hover:bg-[#10233f] text-[#6d8ead] hover:text-white text-xs font-semibold transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> ¿Aún no tienes el JSON? Copiar prompt para el chatbot
                  </button>
                  <div>
                    <label className="flex flex-col items-center justify-center border border-dashed border-[#1f2937] hover:border-[#6d8ead]/40 rounded-xl p-4 cursor-pointer bg-[#0a0f1d]/50 transition-colors">
                      <Download className="w-5 h-5 text-[#6d8ead] mb-1" />
                      <span className="text-[10px] font-semibold text-white">Subir archivo .json</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              if (evt.target?.result) {
                                setJsonText(evt.target.result as string);
                              }
                            };
                            reader.readAsText(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#6d8ead] mb-1 block">O pega el JSON directamente aquí:</label>
                    <textarea
                      rows={6}
                      placeholder='{ "company": "Zalando", "roleTitle": "Business Steering Analyst", ... }'
                      value={jsonText}
                      onChange={(e) => setJsonText(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs font-mono focus:border-[#6d8ead] outline-none leading-normal resize-y"
                    />
                    {validationSummary && (
                      <div className={`mt-3 p-3 rounded-xl border text-xs leading-relaxed ${
                        validationSummary.valid 
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                      }`}>
                        <p className="font-bold mb-1">
                          {validationSummary.valid ? "✓ Valid JSON structure" : "⚠ Validation Issues / Errors"}
                        </p>
                        {validationSummary.valid ? (
                          <div className="space-y-1 mt-1 text-[11px] text-slate-300">
                            <p><strong className="text-white">Company:</strong> {validationSummary.company}</p>
                            <p><strong className="text-white">Position:</strong> {validationSummary.roleTitle}</p>
                            {validationSummary.fitScore !== null && validationSummary.fitScore !== undefined && (
                              <p><strong className="text-white">Fit Score:</strong> {validationSummary.fitScore}/10</p>
                            )}
                            {validationSummary.priority && (
                              <p><strong className="text-white">Priority:</strong> {validationSummary.priority}</p>
                            )}
                            {validationSummary.positioning && (
                              <p><strong className="text-white">Recommended Positioning:</strong> {validationSummary.positioning}</p>
                            )}
                          </div>
                        ) : (
                          <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                            {validationSummary.errors?.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewModal(false);
                    setJsonText("");
                  }}
                  className="px-4 py-2 rounded-xl bg-[#10233f]/50 hover:bg-[#10233f] text-[#6d8ead] border border-[#6d8ead]/10 font-semibold text-sm transition-all"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#10233f] to-[#1d3d6b] hover:from-[#152d50] hover:to-[#244e88] text-white font-semibold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center min-w-[100px]"
                  disabled={creating}
                >
                  {creating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  ) : (
                    importMode === "json" ? "Import & Create" : "Create Draft"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* AI Prompt Generator */}
      <PromptGeneratorModal isOpen={showPromptModal} onClose={() => setShowPromptModal(false)} />

      {/* Signature Drawing Pad Overlay */}
      <SignaturePad
        isOpen={showSigPad}
        onClose={() => setShowSigPad(false)}
        onSave={handleSaveDrawnSignature}
      />
    </div>
  );
}
