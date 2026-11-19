import React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { Application, MasterCv, ProjectEntry } from "@/lib/schemas";
import { SaveSectionButton } from "./SaveSectionButton";

interface CvProjectsTabProps {
  app: Application;
  setApp: React.Dispatch<React.SetStateAction<Application | null>>;
  masterCv?: MasterCv | null;
  saving: boolean;
  onSave: () => void;
}

/**
 * Editor tab for managing independent projects, case studies, and portfolio initiatives on the CV.
 */
export function CvProjectsTab({ app, setApp, masterCv, saving, onSave }: CvProjectsTabProps) {
  const fieldId = React.useId();
  const projects = React.useMemo(() => app.cvContent.projects || [], [app.cvContent.projects]);
  const omittedMasterProjects = React.useMemo(() => {
    if (!masterCv?.projectsHistory?.length) return [];
    const presentIds = new Set(projects.map((p) => p.id));
    return masterCv.projectsHistory.filter((entry) => !presentIds.has(entry.id));
  }, [masterCv, projects]);

  const updateProject = (idx: number, patch: Partial<ProjectEntry>) => {
    const next = [...projects];
    next[idx] = { ...next[idx], ...patch };
    setApp({ ...app, cvContent: { ...app.cvContent, projects: next } });
  };

  const moveProject = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= projects.length) return;
    const next = [...projects];
    const [picked] = next.splice(idx, 1);
    next.splice(target, 0, picked);
    setApp({ ...app, cvContent: { ...app.cvContent, projects: next } });
  };

  return (
    <div className="ui-controls space-y-6">
      <div className="border-b border-[var(--ui-border)] pb-2">
        <h3 className="text-sm font-bold text-white">Projects</h3>
        <p className="text-xs text-slate-400">
          Edit, reorder, and choose which projects appear on this CV.
        </p>
      </div>

      {projects.map((proj, projIdx) => (
        <div key={proj.id || projIdx} className={`ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] space-y-3 transition-opacity ${proj.include === false ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-[var(--ui-border)]">
            <span className="text-xs font-bold text-slate-200 truncate">{proj.title || `Project ${projIdx + 1}`}</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                aria-label="Move project up"
                disabled={projIdx === 0}
                onClick={() => moveProject(projIdx, -1)}
                className="p-1 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-slate-300 hover:text-white disabled:opacity-30"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Move project down"
                disabled={projIdx === projects.length - 1}
                onClick={() => moveProject(projIdx, 1)}
                className="p-1 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-slate-300 hover:text-white disabled:opacity-30"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <label className="flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={proj.include !== false}
                  onChange={(e) => updateProject(projIdx, { include: e.target.checked })}
                  className="rounded border-slate-600 bg-[var(--ui-inset)]"
                />
                Include in CV
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${fieldId}-field-1-${projIdx}`} className="text-xs font-bold text-[#6d8ead] block mb-1">Project name</label>
              <input id={`${fieldId}-field-1-${projIdx}`}
                type="text"
                value={proj.title}
                onChange={(e) => updateProject(projIdx, { title: e.target.value })}
                className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-field-2-${projIdx}`} className="text-xs font-bold text-[#6d8ead] block mb-1">Role or subtitle</label>
              <input id={`${fieldId}-field-2-${projIdx}`}
                type="text"
                value={proj.role}
                onChange={(e) => updateProject(projIdx, { role: e.target.value })}
                className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${fieldId}-field-3-${projIdx}`} className="text-xs font-bold text-[#6d8ead] block mb-1">Dates or period</label>
              <input id={`${fieldId}-field-3-${projIdx}`}
                type="text"
                value={proj.dates}
                onChange={(e) => updateProject(projIdx, { dates: e.target.value })}
                className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-field-4-${projIdx}`} className="text-xs font-bold text-[#6d8ead] block mb-1">Short description</label>
              <input id={`${fieldId}-field-4-${projIdx}`}
                type="text"
                value={proj.description}
                onChange={(e) => updateProject(projIdx, { description: e.target.value })}
                className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#6d8ead] block">Project details</h4>
            {(proj.bullets || []).map((bullet, bIdx) => (
              <div key={bIdx} className="ui-inset flex gap-2 items-start bg-[#0a0f1d] p-2 rounded border border-[#1f2937]/40">
                <textarea aria-label={`Detail ${bIdx + 1}`} id={`${fieldId}-field-5-${projIdx}-${bIdx}`}
                  rows={2}
                  value={bullet}
                  placeholder="Contribution, approach, or measurable outcome..."
                  onChange={(e) => {
                    const nextBullets = [...(proj.bullets || [])];
                    nextBullets[bIdx] = e.target.value;
                    updateProject(projIdx, { bullets: nextBullets });
                  }}
                  className="min-w-0 flex-1 bg-transparent text-white text-xs leading-relaxed resize-y"
                />
                <button aria-label="Remove project detail"
                  type="button"
                  onClick={() =>
                    updateProject(projIdx, {
                      bullets: (proj.bullets || []).filter((_, i) => i !== bIdx),
                    })
                  }
                  className="ui-button ui-button--danger text-rose-400 hover:text-rose-300 p-0.5 font-bold"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 justify-between items-center pt-1.5">
            <button
              type="button"
              onClick={() =>
                updateProject(projIdx, {
                  bullets: [...(proj.bullets || []), ""],
                })
              }
              className="ui-button ui-button--secondary text-xs text-[#8db2d6] hover:underline"
            >
              + Add detail
            </button>
            <button
              type="button"
              onClick={() => {
                setApp({
                  ...app,
                  cvContent: {
                    ...app.cvContent,
                    projects: projects.filter((_, i) => i !== projIdx),
                  },
                });
              }}
              className="ui-button ui-button--danger text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove project
            </button>
          </div>
        </div>
      ))}

      {omittedMasterProjects.length > 0 && (
        <div className="ui-panel bg-[var(--ui-inset)] p-4 rounded-xl border border-dashed border-[#35465f] space-y-2.5">
          <p className="text-xs font-bold text-slate-300">
            Master CV projects not included in this application ({omittedMasterProjects.length})
          </p>
          <div className="space-y-1.5">
            {omittedMasterProjects.map((proj) => (
              <div key={proj.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--ui-surface)] border border-[var(--ui-border)] px-3 py-2">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-white block truncate">{proj.title}</span>
                  <span className="text-[11px] text-slate-400">{proj.role} · {proj.dates}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setApp((prev) =>
                      prev
                        ? {
                            ...prev,
                            cvContent: {
                              ...prev.cvContent,
                              projects: [...(prev.cvContent.projects || []), { ...structuredClone(proj), include: true }],
                            },
                          }
                        : prev
                    )
                  }
                  className="ui-button ui-button--secondary text-xs flex items-center gap-1 text-emerald-300"
                >
                  <Plus className="w-3.5 h-3.5" /> Add to CV
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => {
            const newProj: ProjectEntry = {
              id: `proj-${Date.now()}`,
              title: "",
              role: "",
              dates: "",
              description: "",
              bullets: [""],
            };
            setApp({
              ...app,
              cvContent: { ...app.cvContent, projects: [...projects, newProj] },
            });
          }}
          className="ui-button ui-button--secondary flex items-center gap-1.5 text-xs text-[#8db2d6] hover:underline"
        >
          <Plus className="w-3.5 h-3.5" /> Add project
        </button>
      </div>

      <SaveSectionButton label="Save projects" saving={saving} onSave={onSave} />
    </div>
  );
}
