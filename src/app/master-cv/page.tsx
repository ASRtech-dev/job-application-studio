"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Plus, Trash, Check, HelpCircle } from "lucide-react";
import confetti from "canvas-confetti";
import { MasterCv, SkillGroup, ExperienceEntry, CertificationEntry, EducationEntry, ProjectEntry } from "@/lib/schemas";

export default function MasterCvEditor() {
  const [data, setData] = useState<MasterCv | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "variants" | "achievements" | "skills" | "experience" | "projects">("general");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/master-cv");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch("/api/master-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        alert("Master CV updated successfully!");
      } else {
        const errJson = await res.json();
        alert("Validation error: " + JSON.stringify(errJson.details || errJson.error));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save Master CV.");
    } finally {
      setSaving(false);
    }
  };

  // Helper functions to manage deep fields
  const updateGeneral = (field: keyof MasterCv, value: any) => {
    if (!data) return;
    setData({ ...data, [field]: value });
  };

  const handleAddLink = () => {
    if (!data) return;
    const links = [...data.links, { label: "", url: "" }];
    setData({ ...data, links });
  };

  const handleRemoveLink = (idx: number) => {
    if (!data) return;
    const links = data.links.filter((_, i) => i !== idx);
    setData({ ...data, links });
  };

  const handleLinkChange = (idx: number, field: "label" | "url", val: string) => {
    if (!data) return;
    const links = [...data.links];
    links[idx] = { ...links[idx], [field]: val };
    setData({ ...data, links });
  };

  const handleHeadlineChange = (idx: number, val: string) => {
    if (!data) return;
    const headlineVariants = [...data.headlineVariants];
    headlineVariants[idx].headline = val;
    setData({ ...data, headlineVariants });
  };

  const handleProfileVariantChange = (idx: number, val: string) => {
    if (!data) return;
    const profileVariants = [...data.profileVariants];
    profileVariants[idx].text = val;
    setData({ ...data, profileVariants });
  };

  const handleAddAchievement = () => {
    if (!data) return;
    const achievementsPool = ["New achievement details...", ...data.achievementsPool];
    setData({ ...data, achievementsPool });
  };

  const handleRemoveAchievement = (idx: number) => {
    if (!data) return;
    const achievementsPool = data.achievementsPool.filter((_, i) => i !== idx);
    setData({ ...data, achievementsPool });
  };

  const handleAchievementChange = (idx: number, val: string) => {
    if (!data) return;
    const achievementsPool = [...data.achievementsPool];
    achievementsPool[idx] = val;
    setData({ ...data, achievementsPool });
  };

  // Skills Group CRUD
  const handleAddSkillGroup = () => {
    if (!data) return;
    const skillsPool = [...data.skillsPool, { group: "New Group Name", skills: ["Skill 1"] }];
    setData({ ...data, skillsPool });
  };

  const handleRemoveSkillGroup = (gIdx: number) => {
    if (!data) return;
    const skillsPool = data.skillsPool.filter((_, i) => i !== gIdx);
    setData({ ...data, skillsPool });
  };

  const handleSkillGroupTitleChange = (gIdx: number, val: string) => {
    if (!data) return;
    const skillsPool = [...data.skillsPool];
    skillsPool[gIdx].group = val;
    setData({ ...data, skillsPool });
  };

  const handleAddSkillToGroup = (gIdx: number) => {
    if (!data) return;
    const skillsPool = [...data.skillsPool];
    skillsPool[gIdx].skills.push("New Skill");
    setData({ ...data, skillsPool });
  };

  const handleRemoveSkillFromGroup = (gIdx: number, sIdx: number) => {
    if (!data) return;
    const skillsPool = [...data.skillsPool];
    skillsPool[gIdx].skills = skillsPool[gIdx].skills.filter((_, i) => i !== sIdx);
    setData({ ...data, skillsPool });
  };

  const handleSkillNameChange = (gIdx: number, sIdx: number, val: string) => {
    if (!data) return;
    const skillsPool = [...data.skillsPool];
    skillsPool[gIdx].skills[sIdx] = val;
    setData({ ...data, skillsPool });
  };

  // Experience CRUD
  const handleUpdateExperience = (idx: number, field: keyof ExperienceEntry, val: any) => {
    if (!data) return;
    const experienceHistory = [...data.experienceHistory];
    experienceHistory[idx] = { ...experienceHistory[idx], [field]: val } as any;
    setData({ ...data, experienceHistory });
  };

  const handleAddExperienceBullet = (expIdx: number) => {
    if (!data) return;
    const experienceHistory = [...data.experienceHistory];
    experienceHistory[expIdx].bullets.push("New job achievement bullet...");
    setData({ ...data, experienceHistory });
  };

  const handleRemoveExperienceBullet = (expIdx: number, bIdx: number) => {
    if (!data) return;
    const experienceHistory = [...data.experienceHistory];
    experienceHistory[expIdx].bullets = experienceHistory[expIdx].bullets.filter((_, i) => i !== bIdx);
    setData({ ...data, experienceHistory });
  };

  const handleExperienceBulletChange = (expIdx: number, bIdx: number, val: string) => {
    if (!data) return;
    const experienceHistory = [...data.experienceHistory];
    experienceHistory[expIdx].bullets[bIdx] = val;
    setData({ ...data, experienceHistory });
  };

  // Projects CRUD
  const handleUpdateProject = (idx: number, field: keyof ProjectEntry, val: any) => {
    if (!data) return;
    const projectsHistory = [...(data.projectsHistory || [])];
    projectsHistory[idx] = { ...projectsHistory[idx], [field]: val } as any;
    setData({ ...data, projectsHistory });
  };

  const handleAddProject = () => {
    if (!data) return;
    const newProj: ProjectEntry = {
      id: `proj-${Date.now()}`,
      title: "New Project",
      role: "Role",
      dates: "Period",
      description: "Short description",
      bullets: ["Detail bullet..."]
    };
    const projectsHistory = [...(data.projectsHistory || []), newProj];
    setData({ ...data, projectsHistory });
  };

  const handleRemoveProject = (idx: number) => {
    if (!data) return;
    const projectsHistory = (data.projectsHistory || []).filter((_, i) => i !== idx);
    setData({ ...data, projectsHistory });
  };

  const handleAddProjectBullet = (projIdx: number) => {
    if (!data) return;
    const projectsHistory = [...(data.projectsHistory || [])];
    if (!projectsHistory[projIdx].bullets) {
      projectsHistory[projIdx].bullets = [];
    }
    projectsHistory[projIdx].bullets.push("New detail bullet...");
    setData({ ...data, projectsHistory });
  };

  const handleRemoveProjectBullet = (projIdx: number, bIdx: number) => {
    if (!data) return;
    const projectsHistory = [...(data.projectsHistory || [])];
    projectsHistory[projIdx].bullets = projectsHistory[projIdx].bullets.filter((_, i) => i !== bIdx);
    setData({ ...data, projectsHistory });
  };

  const handleProjectBulletChange = (projIdx: number, bIdx: number, val: string) => {
    if (!data) return;
    const projectsHistory = [...(data.projectsHistory || [])];
    projectsHistory[projIdx].bullets[bIdx] = val;
    setData({ ...data, projectsHistory });
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#0a0f1d] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6d8ead]"></div>
        <p className="mt-4 text-[#6d8ead]">Loading Master profile...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#0a0f1d] text-white">
        <p className="text-red-400">Failed to load data. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#0a0f1d] text-[#ededed] font-sans selection:bg-[#6d8ead] selection:text-white">
      
      {/* Top Navbar */}
      <header className="border-b border-[#1f2937]/60 bg-[#0c1328]/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg bg-[#10233f] border border-[#6d8ead]/25 hover:bg-[#152e52] text-[#6d8ead] hover:text-white transition-colors duration-200">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Edit Master CV Reference</h1>
            <p className="text-xs text-[#6d8ead]">Configure your primary professional data bank</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#10233f] to-[#1d3d6b] hover:from-[#152d50] hover:to-[#244e88] text-white font-semibold shadow-lg shadow-[#10233f]/40 transition-all border border-[#6d8ead]/20 active:scale-95 disabled:opacity-50"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
          ) : (
            <>
              <Save className="w-4 h-4" /> Save Master Data
            </>
          )}
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#1f2937] mb-8 overflow-x-auto gap-2 pb-px">
          {[
            { id: "general", label: "General & Contact" },
            { id: "variants", label: "Headline & Profiles" },
            { id: "achievements", label: "Achievements Library" },
            { id: "skills", label: "Core Skills Pool" },
            { id: "experience", label: "Experience Details" },
            { id: "projects", label: "Projects Details" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors duration-200 ${
                activeTab === tab.id
                  ? "border-[#6d8ead] text-white bg-[#10233f]/30"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: General Info & Links */}
        {activeTab === "general" && (
          <div className="space-y-6 max-w-3xl">
            <div className="rounded-2xl border border-[#1f2937]/80 bg-[#0e162d]/60 p-6 space-y-4">
              <h3 className="text-base font-bold text-white border-b border-[#1f2937] pb-2">Primary Info</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={data.fullName}
                    onChange={(e) => updateGeneral("fullName", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white focus:outline-none focus:border-[#6d8ead] text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Location</label>
                  <input
                    type="text"
                    value={data.location}
                    onChange={(e) => updateGeneral("location", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white focus:outline-none focus:border-[#6d8ead] text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Email</label>
                  <input
                    type="email"
                    value={data.email}
                    onChange={(e) => updateGeneral("email", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white focus:outline-none focus:border-[#6d8ead] text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Phone</label>
                  <input
                    type="text"
                    value={data.phone}
                    onChange={(e) => updateGeneral("phone", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white focus:outline-none focus:border-[#6d8ead] text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Availability Status</label>
                  <input
                    type="text"
                    value={data.availability}
                    onChange={(e) => updateGeneral("availability", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white focus:outline-none focus:border-[#6d8ead] text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Links Block */}
            <div className="rounded-2xl border border-[#1f2937]/80 bg-[#0e162d]/60 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#1f2937] pb-2">
                <h3 className="text-base font-bold text-white">Social Links</h3>
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="flex items-center gap-1 text-xs text-[#6d8ead] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Link
                </button>
              </div>

              {data.links.map((link, idx) => (
                <div key={idx} className="flex gap-4 items-center bg-[#0a0f1d] p-3 rounded-lg border border-[#1f2937]/40">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Label (e.g. GitHub)"
                      value={link.label}
                      onChange={(e) => handleLinkChange(idx, "label", e.target.value)}
                      className="px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                    />
                    <input
                      type="text"
                      placeholder="URL (https://...)"
                      value={link.url}
                      onChange={(e) => handleLinkChange(idx, "url", e.target.value)}
                      className="col-span-2 px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveLink(idx)}
                    className="p-1.5 text-rose-400 hover:bg-rose-900/20 rounded"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Headline & Profile Variants */}
        {activeTab === "variants" && (
          <div className="space-y-8 max-w-4xl">
            
            {/* Headline Variants */}
            <div className="rounded-2xl border border-[#1f2937]/80 bg-[#0e162d]/60 p-6 space-y-4">
              <h3 className="text-base font-bold text-white border-b border-[#1f2937] pb-2">
                Headline / Title Banner Variants
              </h3>
              <p className="text-xs text-[#6b7280]">
                These variants will be selected depending on the target role title.
              </p>

              <div className="space-y-4">
                {data.headlineVariants.map((item, idx) => (
                  <div key={idx} className="space-y-1 bg-[#0a0f1d] p-4 rounded-xl border border-[#1f2937]/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d8ead]">{item.category}</span>
                    <input
                      type="text"
                      value={item.headline}
                      onChange={(e) => handleHeadlineChange(idx, e.target.value)}
                      className="w-full px-3 py-2 rounded bg-[#0a0f1d] border border-[#1f2937] text-white focus:outline-none text-xs font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Profile Variants */}
            <div className="rounded-2xl border border-[#1f2937]/80 bg-[#0e162d]/60 p-6 space-y-4">
              <h3 className="text-base font-bold text-white border-b border-[#1f2937] pb-2">
                Professional Profile / Summary Variants
              </h3>
              <p className="text-xs text-[#6b7280]">
                Targeted bio paragraphs written specifically for different operational disciplines.
              </p>

              <div className="space-y-4">
                {data.profileVariants.map((item, idx) => (
                  <div key={idx} className="space-y-1.5 bg-[#0a0f1d] p-4 rounded-xl border border-[#1f2937]/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d8ead]">{item.category}</span>
                    <textarea
                      rows={4}
                      value={item.text}
                      onChange={(e) => handleProfileVariantChange(idx, e.target.value)}
                      className="w-full px-3 py-2 rounded bg-[#0a0f1d] border border-[#1f2937] text-white focus:outline-none text-xs leading-relaxed"
                    />
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Tab 3: Achievements Library */}
        {activeTab === "achievements" && (
          <div className="rounded-2xl border border-[#1f2937]/80 bg-[#0e162d]/60 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f2937] pb-2">
              <div>
                <h3 className="text-base font-bold text-white">Achievements Library</h3>
                <p className="text-xs text-[#6b7280]">
                  Factual, verified achievements that you can select for tailored CV summaries.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddAchievement}
                className="flex items-center gap-1 text-xs text-[#6d8ead] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add Achievement
              </button>
            </div>

            <div className="space-y-3">
              {data.achievementsPool.map((achievement, idx) => (
                <div key={idx} className="flex gap-4 items-start bg-[#0a0f1d] p-3 rounded-lg border border-[#1f2937]/40">
                  <span className="text-xs font-semibold text-[#6d8ead] pt-2">#{idx + 1}</span>
                  <textarea
                    rows={2}
                    value={achievement}
                    onChange={(e) => handleAchievementChange(idx, e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveAchievement(idx)}
                    className="p-1.5 text-rose-400 hover:bg-rose-900/20 rounded mt-1"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Core Skills Pool */}
        {activeTab === "skills" && (
          <div className="rounded-2xl border border-[#1f2937]/80 bg-[#0e162d]/60 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[#1f2937] pb-2">
              <div>
                <h3 className="text-base font-bold text-white">Core Skills Categories</h3>
                <p className="text-xs text-[#6b7280]">
                  Grouped catalog of technical tools, methodologies, and operational expertise.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddSkillGroup}
                className="flex items-center gap-1 text-xs text-[#6d8ead] hover:underline bg-[#10233f] px-3 py-1.5 rounded border border-[#6d8ead]/20"
              >
                <Plus className="w-3.5 h-3.5" /> Add Category
              </button>
            </div>

            <div className="space-y-6">
              {data.skillsPool.map((group, gIdx) => (
                <div key={gIdx} className="bg-[#0a0f1d] p-5 rounded-2xl border border-[#1f2937] relative">
                  
                  <div className="flex items-center justify-between mb-4 border-b border-[#1f2937] pb-2">
                    <input
                      type="text"
                      value={group.group}
                      onChange={(e) => handleSkillGroupTitleChange(gIdx, e.target.value)}
                      className="bg-transparent border-b border-transparent hover:border-[#6d8ead] focus:border-[#6d8ead] font-bold text-white text-sm outline-none px-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSkillGroup(gIdx)}
                      className="text-xs text-rose-400 hover:underline flex items-center gap-1"
                    >
                      <Trash className="w-3 h-3" /> Remove Category
                    </button>
                  </div>

                  {/* Skills tags list */}
                  <div className="flex flex-wrap gap-2 items-center">
                    {group.skills.map((skill, sIdx) => (
                      <div key={sIdx} className="flex items-center bg-[#10233f]/50 border border-[#6d8ead]/25 px-2.5 py-1 rounded-lg gap-1.5 text-xs text-slate-200">
                        <input
                          type="text"
                          value={skill}
                          onChange={(e) => handleSkillNameChange(gIdx, sIdx, e.target.value)}
                          className="bg-transparent outline-none border-b border-transparent focus:border-[#6d8ead] w-24 text-center text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveSkillFromGroup(gIdx, sIdx)}
                          className="hover:text-rose-400"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAddSkillToGroup(gIdx)}
                      className="px-2.5 py-1 text-xs rounded-lg border border-dashed border-[#6d8ead]/40 hover:border-[#6d8ead] text-[#6d8ead] flex items-center gap-1"
                    >
                      + Add tag
                    </button>
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 5: Experience Details */}
        {activeTab === "experience" && (
          <div className="space-y-6">
            <h3 className="text-base font-bold text-white px-2">Work History Catalog</h3>
            
            {data.experienceHistory.map((exp, expIdx) => (
              <div key={exp.id || expIdx} className="rounded-2xl border border-[#1f2937]/80 bg-[#0e162d]/60 p-6 space-y-4">
                
                {/* Meta details */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-4 border-b border-[#1f2937]/60">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6d8ead] block mb-1">Job Title</label>
                    <input
                      type="text"
                      value={exp.jobTitle}
                      onChange={(e) => handleUpdateExperience(expIdx, "jobTitle", e.target.value)}
                      className="w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6d8ead] block mb-1">Company</label>
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) => handleUpdateExperience(expIdx, "company", e.target.value)}
                      className="w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6d8ead] block mb-1">Dates</label>
                    <input
                      type="text"
                      value={exp.dates}
                      onChange={(e) => handleUpdateExperience(expIdx, "dates", e.target.value)}
                      className="w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6d8ead] block mb-1">Location</label>
                    <input
                      type="text"
                      value={exp.location}
                      onChange={(e) => handleUpdateExperience(expIdx, "location", e.target.value)}
                      className="w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                    />
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6d8ead] block mb-1">Role Summary</label>
                  <input
                    type="text"
                    value={exp.summary || ""}
                    onChange={(e) => handleUpdateExperience(expIdx, "summary", e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                  />
                </div>

                {/* Bullets library */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b border-[#1f2937] pb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Experience Bullets</span>
                    <button
                      type="button"
                      onClick={() => handleAddExperienceBullet(expIdx)}
                      className="text-[11px] text-[#6d8ead] hover:underline"
                    >
                      + Add Bullet
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {exp.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex gap-3 items-start bg-[#0a0f1d]/50 p-2.5 rounded-lg border border-[#1f2937]/30">
                        <span className="text-xs text-[#6d8ead] pt-1.5">•</span>
                        <textarea
                          rows={2}
                          value={bullet}
                          onChange={(e) => handleExperienceBulletChange(expIdx, bIdx, e.target.value)}
                          className="flex-1 bg-[#0a0f1d] border border-[#1f2937] text-white text-xs p-1.5 rounded leading-relaxed focus:outline-none focus:border-[#6d8ead]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveExperienceBullet(expIdx, bIdx)}
                          className="p-1 text-rose-400 hover:bg-rose-900/20 rounded mt-1"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

        {/* Tab 6: Projects Details */}
        {activeTab === "projects" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-base font-bold text-white">Projects Catalog</h3>
              <button
                type="button"
                onClick={handleAddProject}
                className="flex items-center gap-1 text-xs text-[#6d8ead] hover:underline bg-[#10233f] px-3 py-1.5 rounded border border-[#6d8ead]/20"
              >
                <Plus className="w-3.5 h-3.5" /> Add Project
              </button>
            </div>
            
            {(data.projectsHistory || []).map((proj, projIdx) => (
              <div key={proj.id || projIdx} className="rounded-2xl border border-[#1f2937]/80 bg-[#0e162d]/60 p-6 space-y-4">
                
                {/* Meta details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-[#1f2937]/60">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6d8ead] block mb-1">Project Title</label>
                    <input
                      type="text"
                      value={proj.title}
                      onChange={(e) => handleUpdateProject(projIdx, "title", e.target.value)}
                      className="w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6d8ead] block mb-1">Role</label>
                    <input
                      type="text"
                      value={proj.role}
                      onChange={(e) => handleUpdateProject(projIdx, "role", e.target.value)}
                      className="w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6d8ead] block mb-1">Dates</label>
                    <input
                      type="text"
                      value={proj.dates}
                      onChange={(e) => handleUpdateProject(projIdx, "dates", e.target.value)}
                      className="w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6d8ead] block mb-1">Short Description</label>
                  <input
                    type="text"
                    value={proj.description}
                    onChange={(e) => handleUpdateProject(projIdx, "description", e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                  />
                </div>

                {/* Bullets library */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b border-[#1f2937] pb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Project Bullets / Details</span>
                    <button
                      type="button"
                      onClick={() => handleAddProjectBullet(projIdx)}
                      className="text-[11px] text-[#6d8ead] hover:underline"
                    >
                      + Add Bullet
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {(proj.bullets || []).map((bullet, bIdx) => (
                      <div key={bIdx} className="flex gap-3 items-start bg-[#0a0f1d]/50 p-2.5 rounded-lg border border-[#1f2937]/30">
                        <span className="text-xs text-[#6d8ead] pt-1.5">•</span>
                        <textarea
                          rows={2}
                          value={bullet}
                          onChange={(e) => handleProjectBulletChange(projIdx, bIdx, e.target.value)}
                          className="flex-1 bg-[#0a0f1d] border border-[#1f2937] text-white text-xs p-1.5 rounded leading-relaxed focus:outline-none focus:border-[#6d8ead]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveProjectBullet(projIdx, bIdx)}
                          className="p-1 text-rose-400 hover:bg-rose-900/20 rounded mt-1"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => handleRemoveProject(projIdx)}
                    className="text-xs text-rose-400 hover:underline flex items-center gap-1"
                  >
                    <Trash className="w-3 h-3" /> Remove Project
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
