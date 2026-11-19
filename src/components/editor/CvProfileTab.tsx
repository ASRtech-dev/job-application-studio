import React from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import type { Application } from "@/lib/schemas";
import { SaveSectionButton } from "./SaveSectionButton";

interface CvProfileTabProps {
  app: Application;
  setApp: React.Dispatch<React.SetStateAction<Application | null>>;
  updateCvHeader: (field: string, val: string) => void;
  updateCvProfile: (val: string) => void;
  saving: boolean;
  onSave: () => void;
}

/**
 * Editor tab for application company/role target, headline, professional profile, links, language, and contact header fields.
 */
export function CvProfileTab({
  app,
  setApp,
  updateCvHeader,
  updateCvProfile,
  saving,
  onSave,
}: CvProfileTabProps) {
  const links = app.cvContent.header.links || [];
  return (
    <div className="ui-controls space-y-5">
      {/* Application Target (Company & Position) */}
      <div className="ui-panel rounded-xl border border-amber-500/25 bg-[var(--ui-surface-2)] p-4 space-y-3">
        <h3 className="text-sm font-bold text-amber-300 mb-1 flex items-center gap-1.5">
          <Edit3 className="w-3.5 h-3.5" /> Application target
        </h3>
        <p className="text-xs text-slate-400 -mt-1 mb-2">
          Target company, role title, and document output language for this application.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="field-company" className="text-xs font-bold text-amber-400/80 block mb-1">Company</label>
            <input
              id="field-company"
              type="text"
              value={app.company}
              onChange={(e) => setApp({ ...app, company: e.target.value })}
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-amber-500/30 text-white text-xs focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors"
              placeholder="Company name"
            />
          </div>
          <div>
            <label htmlFor="field-roleTitle" className="text-xs font-bold text-amber-400/80 block mb-1">Role title</label>
            <input
              id="field-roleTitle"
              type="text"
              value={app.roleTitle}
              onChange={(e) => setApp({ ...app, roleTitle: e.target.value })}
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-amber-500/30 text-white text-xs focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors"
              placeholder="Job title"
            />
          </div>
          <div>
            <label htmlFor="field-document-language" className="text-xs font-bold text-[#8db2d6] block mb-1">Document language</label>
            <select
              id="field-document-language"
              value={app.language}
              onChange={(e) => setApp({ ...app, language: e.target.value as Application["language"] })}
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
            >
              <option value="English">English</option>
              <option value="German">German (Deutsch)</option>
              <option value="Spanish">Spanish (Español)</option>
            </select>
          </div>
          <div>
            <label htmlFor="field-cv-availability" className="text-xs font-bold text-[#8db2d6] block mb-1">Availability (CV header)</label>
            <input
              id="field-cv-availability"
              type="text"
              value={app.cvContent.header.availability}
              onChange={(e) => updateCvHeader("availability", e.target.value)}
              placeholder="e.g. Immediate / 30 days' notice / By agreement"
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-white mb-2">Headline &amp; professional profile</h3>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="field-cv-headline" className="text-xs font-bold text-[#8db2d6] block">Professional headline</label>
          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            Document content
          </span>
        </div>
        <input
          id="field-cv-headline"
          type="text"
          value={app.cvContent.header.headline}
          onChange={(e) => updateCvHeader("headline", e.target.value)}
          className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="field-profile-summary" className="text-xs font-bold text-[#8db2d6] block">Professional summary</label>
          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            Document content
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-1.5">
          Edit this summary and review how it reads in the live preview.
        </p>
        <textarea
          id="field-profile-summary"
          rows={8}
          value={app.cvContent.professionalProfile}
          onChange={(e) => updateCvProfile(e.target.value)}
          className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
        />
      </div>

      <div className="border-t border-[var(--ui-border)] pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="field-email" className="text-xs font-bold text-[#8db2d6] block mb-1">Email</label>
          <input
            id="field-email"
            type="email"
            value={app.cvContent.header.email}
            onChange={(e) => updateCvHeader("email", e.target.value)}
            className="min-w-0 w-full px-3 py-1.5 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
          />
        </div>
        <div>
          <label htmlFor="field-phone" className="text-xs font-bold text-[#8db2d6] block mb-1">Phone</label>
          <input
            id="field-phone"
            type="text"
            value={app.cvContent.header.phone}
            onChange={(e) => updateCvHeader("phone", e.target.value)}
            className="min-w-0 w-full px-3 py-1.5 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="field-cv-location" className="text-xs font-bold text-[#8db2d6] block mb-1">Location</label>
          <input
            id="field-cv-location"
            type="text"
            value={app.cvContent.header.location}
            onChange={(e) => updateCvHeader("location", e.target.value)}
            className="min-w-0 w-full px-3 py-1.5 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
          />
        </div>
      </div>

      <div id="field-cv-links" tabIndex={-1} className="border-t border-[var(--ui-border)] pt-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-white">Professional header links</h4>
          <button
            type="button"
            onClick={() =>
              setApp((prev) =>
                prev
                  ? {
                      ...prev,
                      cvContent: {
                        ...prev.cvContent,
                        header: { ...prev.cvContent.header, links: [...(prev.cvContent.header.links || []), { label: "", url: "" }] },
                      },
                    }
                  : prev
              )
            }
            className="ui-button ui-button--secondary text-xs flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add link
          </button>
        </div>
        {links.length === 0 ? (
          <p className="text-xs text-slate-400">No links configured for this application yet.</p>
        ) : (
          <div className="space-y-2">
            {links.map((link, idx) => (
              <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <input
                  type="text"
                  aria-label={`Link label ${idx + 1}`}
                  value={link.label}
                  placeholder="LinkedIn / GitHub / Portfolio"
                  onChange={(e) => {
                    const nextLinks = [...links];
                    nextLinks[idx] = { ...nextLinks[idx], label: e.target.value };
                    setApp((prev) => prev ? { ...prev, cvContent: { ...prev.cvContent, header: { ...prev.cvContent.header, links: nextLinks } } } : prev);
                  }}
                  className="min-w-0 w-full sm:w-36 px-2.5 py-1.5 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
                />
                <input
                  type="url"
                  aria-label={`Link URL ${idx + 1}`}
                  value={link.url}
                  placeholder="https://..."
                  onChange={(e) => {
                    const nextLinks = [...links];
                    nextLinks[idx] = { ...nextLinks[idx], url: e.target.value };
                    setApp((prev) => prev ? { ...prev, cvContent: { ...prev.cvContent, header: { ...prev.cvContent.header, links: nextLinks } } } : prev);
                  }}
                  className="min-w-0 flex-1 w-full px-2.5 py-1.5 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
                />
                <button
                  type="button"
                  aria-label={`Remove link ${idx + 1}`}
                  onClick={() => {
                    const nextLinks = links.filter((_, i) => i !== idx);
                    setApp((prev) => prev ? { ...prev, cvContent: { ...prev.cvContent, header: { ...prev.cvContent.header, links: nextLinks } } } : prev);
                  }}
                  className="ui-button ui-button--danger px-2 py-1.5 text-rose-400 hover:text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <SaveSectionButton label="Save profile & details" saving={saving} onSave={onSave} />
    </div>
  );
}
