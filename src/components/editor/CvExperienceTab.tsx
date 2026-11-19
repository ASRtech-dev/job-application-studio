import React from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import type { Application, ExperienceEntry, MasterCv } from "@/lib/schemas";
import { SaveSectionButton } from "./SaveSectionButton";

interface CvExperienceTabProps {
  app: Application;
  setApp?: React.Dispatch<React.SetStateAction<Application | null>>;
  masterCv?: MasterCv | null;
  updateExperienceBullet: (expIdx: number, bIdx: number, val: string) => void;
  onAddExperienceBullet: (expIdx: number) => void;
  onRemoveExperienceBullet: (expIdx: number, bIdx: number) => void;
  saving: boolean;
  onSave: () => void;
}

/**
 * Editor tab for compiling, toggling, reordering, and tailoring per-role experience bullets.
 */
export function CvExperienceTab({
  app,
  setApp,
  masterCv,
  updateExperienceBullet,
  onAddExperienceBullet,
  onRemoveExperienceBullet,
  saving,
  onSave,
}: CvExperienceTabProps) {
  const fieldId = React.useId();
  const experiences = app.cvContent.experience;
  const omittedMasterRoles = React.useMemo(() => {
    if (!masterCv?.experienceHistory?.length) return [];
    const presentIds = new Set(experiences.map((e) => e.id));
    return masterCv.experienceHistory.filter((entry) => !presentIds.has(entry.id));
  }, [masterCv, experiences]);

  const updateExperience = (idx: number, patch: Partial<ExperienceEntry>) => {
    if (!setApp) return;
    setApp((prev) => {
      if (!prev) return prev;
      const next = [...prev.cvContent.experience];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, cvContent: { ...prev.cvContent, experience: next } };
    });
  };

  const moveExperience = (idx: number, dir: -1 | 1) => {
    if (!setApp) return;
    const target = idx + dir;
    if (target < 0 || target >= experiences.length) return;
    setApp((prev) => {
      if (!prev) return prev;
      const next = [...prev.cvContent.experience];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return { ...prev, cvContent: { ...prev.cvContent, experience: next } };
    });
  };

  const restoreMasterRole = (entry: ExperienceEntry) => {
    if (!setApp) return;
    const restored: ExperienceEntry = {
      ...structuredClone(entry),
      include: true,
      summary: entry.summary || "",
      bullets: entry.bullets?.length
        ? [...entry.bullets]
        : (entry.pillars || []).flatMap((p) => p.duties).slice(0, 3),
    };
    delete restored.pillars;
    setApp((prev) =>
      prev
        ? { ...prev, cvContent: { ...prev.cvContent, experience: [...prev.cvContent.experience, restored] } }
        : prev
    );
  };

  return (
    <div className="ui-controls space-y-6">
      <div className="border-b border-[#1f2937] pb-2">
        <h3 className="text-sm font-bold text-white">Professional experience</h3>
        <p className="text-xs text-slate-500">
          Toggle, reorder, and tailor bullet points for each role.
        </p>
      </div>

      {experiences.map((exp, expIdx) => {
        const included = exp.include !== false;
        return (
          <div
            key={exp.id || expIdx}
            className={`ui-panel bg-[#0e162d] p-4 rounded-xl border border-[#1f2937]/50 space-y-3 transition-opacity ${
              included ? "" : "opacity-60"
            }`}
          >
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div className="min-w-0 flex-1">
                {setApp ? (
                  <input
                    aria-label={`Role title at ${exp.company}`}
                    type="text"
                    value={exp.jobTitle}
                    onChange={(e) => updateExperience(expIdx, { jobTitle: e.target.value })}
                    className="min-w-0 w-full px-2 py-1 rounded bg-[#0a0f1d] border border-[#1f2937] text-xs font-bold text-[#6d8ead]"
                  />
                ) : (
                  <span className="text-xs font-bold text-[#6d8ead]">{exp.jobTitle}</span>
                )}
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  {exp.company}{exp.dates ? ` · ${exp.dates}` : ""}
                </span>
              </div>

              {setApp && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    aria-label="Move experience up"
                    disabled={expIdx === 0}
                    onClick={() => moveExperience(expIdx, -1)}
                    className="p-1 rounded bg-[#0a0f1d] border border-[#1f2937] text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move experience down"
                    disabled={expIdx === experiences.length - 1}
                    onClick={() => moveExperience(expIdx, 1)}
                    className="p-1 rounded bg-[#0a0f1d] border border-[#1f2937] text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <label className="flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={(e) => updateExperience(expIdx, { include: e.target.checked })}
                      className="rounded border-slate-600 bg-[#0a0f1d]"
                    />
                    Include
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {exp.bullets.map((bullet, bIdx) => (
                <div key={bIdx} className="ui-inset flex gap-2 items-start bg-[#0a0f1d] p-2 rounded border border-[#1f2937]/40">
                  <textarea aria-label={`Bullet ${bIdx + 1}`} id={`${fieldId}-field-1-${expIdx}-${bIdx}`}
                    rows={2}
                    value={bullet}
                    placeholder="e.g. Reduced delivery cycle time by 25% by streamlining cross-team handoffs..."
                    onChange={(e) => updateExperienceBullet(expIdx, bIdx, e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-white text-xs leading-relaxed resize-y"
                  />
                  <button aria-label="Remove experience bullet"
                    type="button"
                    onClick={() => onRemoveExperienceBullet(expIdx, bIdx)}
                    className="ui-button ui-button--danger text-rose-400 hover:text-rose-300 p-0.5"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onAddExperienceBullet(expIdx)}
              className="ui-button ui-button--secondary text-xs text-[#6d8ead] hover:underline"
            >
              + Add bullet
            </button>
          </div>
        );
      })}

      {setApp && omittedMasterRoles.length > 0 && (
        <div className="ui-panel bg-[#0a0f1d] p-4 rounded-xl border border-dashed border-[#35465f] space-y-2.5">
          <p className="text-xs font-bold text-slate-300">
            Master CV roles not included in this application ({omittedMasterRoles.length})
          </p>
          <p className="text-[11px] text-slate-400">
            Restore any omitted role with its original bullets in one click if you want to expand this CV.
          </p>
          <div className="space-y-1.5">
            {omittedMasterRoles.map((role) => (
              <div key={role.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#0e162d] border border-[#1f2937] px-3 py-2">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-white block truncate">{role.jobTitle}</span>
                  <span className="text-[11px] text-slate-400">{role.company} · {role.dates}</span>
                </div>
                <button
                  type="button"
                  onClick={() => restoreMasterRole(role)}
                  className="ui-button ui-button--secondary text-xs flex items-center gap-1 text-emerald-300"
                >
                  <Plus className="w-3.5 h-3.5" /> Add to CV
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <SaveSectionButton label="Save experience" saving={saving} onSave={onSave} />
    </div>
  );
}
