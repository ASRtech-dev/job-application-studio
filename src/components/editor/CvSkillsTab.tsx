import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Application } from "@/lib/schemas";
import { SaveSectionButton } from "./SaveSectionButton";

interface CvSkillsTabProps {
  app: Application;
  setApp: React.Dispatch<React.SetStateAction<Application | null>>;
  saving: boolean;
  onSave: () => void;
}

/**
 * Editor tab for customizing CV Key Achievements and grouped Core Skills.
 */
export function CvSkillsTab({ app, setApp, saving, onSave }: CvSkillsTabProps) {
  const fieldId = React.useId();
  const [focusedGroupIdx, setFocusedGroupIdx] = useState<number | null>(null);
  const [skillDraft, setSkillDraft] = useState("");
  return (
    <div className="ui-controls space-y-6">
      <div>
        <h3 className="text-sm font-bold text-white mb-2">Key achievements</h3>
        <p className="text-xs text-slate-400 mb-3">
          Select the achievements most relevant to this role and refine their wording.
        </p>

        <div className="space-y-2.5">
          {app.cvContent.keyAchievements.map((ach, idx) => (
            <div key={idx} className="ui-inset flex gap-2 items-start bg-[var(--ui-inset)] p-2.5 rounded border border-[var(--ui-border)]">
              <textarea aria-label={`Achievement ${idx + 1}`} id={`${fieldId}-field-1-${idx}`}
                rows={2}
                value={ach}
                placeholder="Quantified outcome or concrete milestone..."
                onChange={(e) => {
                  const keyAchievements = [...app.cvContent.keyAchievements];
                  keyAchievements[idx] = e.target.value;
                  setApp({ ...app, cvContent: { ...app.cvContent, keyAchievements } });
                }}
                className="min-w-0 flex-1 bg-transparent text-white text-xs leading-relaxed"
              />
              <button aria-label="Remove achievement"
                type="button"
                onClick={() => {
                  const keyAchievements = app.cvContent.keyAchievements.filter((_, i) => i !== idx);
                  setApp({ ...app, cvContent: { ...app.cvContent, keyAchievements } });
                }}
                className="ui-button ui-button--danger text-rose-400 hover:text-rose-300"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const keyAchievements = [...app.cvContent.keyAchievements, ""];
              setApp({ ...app, cvContent: { ...app.cvContent, keyAchievements } });
            }}
            className="ui-button ui-button--secondary text-xs text-[#8db2d6] hover:underline"
          >
            + Add achievement
          </button>
        </div>
      </div>

      <div className="border-t border-[var(--ui-border)] pt-4">
        <h3 className="text-sm font-bold text-white mb-2">Skill groups</h3>
        <div className="space-y-3">
          {app.cvContent.coreSkills.map((group, idx) => (
            <div key={idx} className="ui-inset bg-[var(--ui-inset)] p-3 rounded border border-[var(--ui-border)] space-y-2">
              <div className="flex flex-wrap gap-3 justify-between items-center">
                <div className="min-w-0 flex-1"><label htmlFor={`${fieldId}-field-2-${idx}`} className="mb-1 block text-xs font-medium text-slate-300">{`Skill group name ${idx + 1}`}</label><input aria-label={`Skill group name ${idx + 1}`} id={`${fieldId}-field-2-${idx}`}
                  type="text"
                  value={group.group}
                  onChange={(e) => {
                    const coreSkills = [...app.cvContent.coreSkills];
                    coreSkills[idx] = { ...coreSkills[idx], group: e.target.value };
                    setApp({ ...app, cvContent: { ...app.cvContent, coreSkills } });
                  }}
                  className="bg-transparent text-xs font-bold text-[#8db2d6] border-b border-transparent focus:border-[#6d8ead] w-full"
                  placeholder="Group name, e.g. Core Tools"
                /></div>
                <button
                  type="button"
                  onClick={() => {
                    setFocusedGroupIdx(null);
                    const coreSkills = app.cvContent.coreSkills.filter((_, i) => i !== idx);
                    setApp({ ...app, cvContent: { ...app.cvContent, coreSkills } });
                  }}
                  className="ui-button ui-button--danger text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Remove group
                </button>
              </div>
              <div>
                <div className="min-w-0"><label htmlFor={`${fieldId}-field-3-${idx}`} className="mb-1 block text-xs font-medium text-slate-300">{`Comma-separated skills ${idx + 1}`}</label><input aria-label={`Comma-separated skills ${idx + 1}`} id={`${fieldId}-field-3-${idx}`}
                  type="text"
                  value={focusedGroupIdx === idx ? skillDraft : group.skills.join(", ")}
                  onFocus={() => {
                    setFocusedGroupIdx(idx);
                    setSkillDraft(group.skills.join(", "));
                  }}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setSkillDraft(raw);
                    const coreSkills = [...app.cvContent.coreSkills];
                    coreSkills[idx] = {
                      ...coreSkills[idx],
                      skills: raw.split(",").map((s) => s.trim()).filter(Boolean),
                    };
                    setApp({ ...app, cvContent: { ...app.cvContent, coreSkills } });
                  }}
                  onBlur={() => setFocusedGroupIdx((current) => (current === idx ? null : current))}
                  className="min-w-0 w-full bg-[var(--ui-inset)] border-b border-[var(--ui-border)] text-white text-xs py-1 focus:border-[#6d8ead]"
                  placeholder="Skills separated by commas"
                /></div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const coreSkills = [...app.cvContent.coreSkills, { group: "", skills: [] }];
              setApp({ ...app, cvContent: { ...app.cvContent, coreSkills } });
            }}
            className="ui-button ui-button--secondary flex items-center gap-1.5 text-xs text-[#8db2d6] hover:underline pt-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add skill group
          </button>
        </div>
      </div>

      <div className="border-t border-[var(--ui-border)] pt-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white">Applied methodologies &amp; competencies (non-certified)</h3>
            <p className="text-xs text-slate-400">
              Rendered as applied competencies, kept separate from accredited certifications.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={app.templateSettings.showSpecializedCompetencies !== false}
              onChange={(e) => setApp({
                ...app,
                templateSettings: { ...app.templateSettings, showSpecializedCompetencies: e.target.checked },
              })}
            />
            Show on CV
          </label>
        </div>
        <div className="space-y-2">
          {(app.cvContent.specializedCompetencies || []).map((item, idx) => (
            <div key={idx} className="ui-inset flex gap-2 items-center bg-[var(--ui-inset)] p-2 rounded border border-[var(--ui-border)]">
              <input
                aria-label={`Applied competency ${idx + 1}`}
                type="text"
                value={item}
                placeholder="e.g. Stakeholder facilitation, budgeting, workflow design..."
                onChange={(e) => {
                  const specializedCompetencies = [...(app.cvContent.specializedCompetencies || [])];
                  specializedCompetencies[idx] = e.target.value;
                  setApp({ ...app, cvContent: { ...app.cvContent, specializedCompetencies } });
                }}
                className="min-w-0 flex-1 bg-transparent text-white text-xs py-1"
              />
              <button
                aria-label="Remove competency"
                type="button"
                onClick={() => {
                  const specializedCompetencies = (app.cvContent.specializedCompetencies || []).filter((_, i) => i !== idx);
                  setApp({ ...app, cvContent: { ...app.cvContent, specializedCompetencies } });
                }}
                className="ui-button ui-button--danger text-rose-400 hover:text-rose-300"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const specializedCompetencies = [...(app.cvContent.specializedCompetencies || []), ""];
              setApp({ ...app, cvContent: { ...app.cvContent, specializedCompetencies } });
            }}
            className="ui-button ui-button--secondary text-xs text-[#8db2d6] hover:underline"
          >
            + Add applied competency
          </button>
        </div>
      </div>

      <SaveSectionButton label="Save skills & achievements" saving={saving} onSave={onSave} />
    </div>
  );
}
