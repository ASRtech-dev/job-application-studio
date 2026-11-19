import React from "react";
import { type DocLang } from "@/lib/localization";
import { buildStarPrepData } from "@/lib/starPrep";
import { type TemplateProps } from "./types";
import { PageBreakGuides } from "./DocumentPrimitives";
import { renderRichText } from "./RichText";

// -------------------------------------------------------------
// 5. STAR INTERVIEW PREPARATION GUIDE TEMPLATE
// -------------------------------------------------------------
const PREP_LABELS: Record<
  DocLang,
  {
    title: string;
    subtitlePrefix: string;
    positioningTitle: string;
    keywordsLabel: string;
    concernsTitle: string;
    neutralizeLabel: string;
    phraseLabel: string;
    storiesTitle: string;
    relevanceLabel: string;
    salaryTitle: string;
    recommendedRange: string;
    safeFloor: string;
    ambitiousAnchor: string;
    anchorScript: string;
    sourceLabel: string;
    keywordsInline: string;
    situationLabel: string;
    taskLabel: string;
    actionLabel: string;
    resultLabel: string;
    privateNote: string;
    fitLabel: string;
    careerArcTitle: string;
    questionsToAskTitle: string;
    callNotesTitle: string;
    logisticsAvailability: string;
    logisticsNotice: string;
    logisticsWorkMode: string;
  }
> = {
  English: {
    title: "Dynamic Interview & STAR Strategy Sheet",
    subtitlePrefix: "Tailored preparation for",
    positioningTitle: "30-Second Opening Pitch & Strategic Focus",
    keywordsLabel: "Priority ATS Keywords to Voice",
    concernsTitle: "Recruiter Objections & Neutralization Scripts",
    neutralizeLabel: "HOW TO NEUTRALIZE",
    phraseLabel: "EXACT PHRASE TO SAY",
    storiesTitle: "Role-Tailored STAR Behavioral Stories",
    relevanceLabel: "Why it matters here",
    salaryTitle: "Compensation Positioning & Anchor Script",
    recommendedRange: "Target Range",
    safeFloor: "Private minimum",
    ambitiousAnchor: "Ambitious Anchor",
    anchorScript: "VERBAL ANCHOR SCRIPT",
    sourceLabel: "Original source quotation",
    keywordsInline: "Matching terms",
    situationLabel: "SITUATION",
    taskLabel: "TASK",
    actionLabel: "ACTION",
    resultLabel: "RESULT",
    privateNote: "Private preparation note — not part of the spoken script",
    fitLabel: "Recorded fit",
    careerArcTitle: "Career Narrative Bridge (Arc)",
    questionsToAskTitle: "Smart Questions to Ask the Interviewer",
    callNotesTitle: "Quick Call Cheat-Sheet",
    logisticsAvailability: "Availability",
    logisticsNotice: "Notice period",
    logisticsWorkMode: "Work mode",
  },
  German: {
    title: "Dynamischer Interview- & STAR-Leitfaden",
    subtitlePrefix: "Maßgeschneiderte Vorbereitung für",
    positioningTitle: "30-Sekunden-Pitch & Strategischer Fokus",
    keywordsLabel: "Wichtige ATS-Schlüsselbegriffe",
    concernsTitle: "Mögliche Recruiter-Einwände & Konter-Sätze",
    neutralizeLabel: "STRATEGIE",
    phraseLabel: "DIREKTE FORMULIERUNG",
    storiesTitle: "Positionsbezogene STAR-Erfolgsgeschichten",
    relevanceLabel: "Relevanz für die Rolle",
    salaryTitle: "Gehaltsstrategie & Verhandlungs-Skript",
    recommendedRange: "Zielkorridor",
    safeFloor: "Private Untergrenze",
    ambitiousAnchor: "Anker-Wert",
    anchorScript: "FORMULIERUNGSVORSCHLAG",
    sourceLabel: "Originalzitat aus der Quelle",
    keywordsInline: "Passende Begriffe",
    situationLabel: "SITUATION",
    taskLabel: "AUFGABE",
    actionLabel: "HANDLUNG",
    resultLabel: "ERGEBNIS",
    privateNote: "Private Vorbereitungsnotiz — kein Teil der Gesprächsformulierung",
    fitLabel: "Festgehaltene Passung",
    careerArcTitle: "Roter Faden / Karriere-Narrativ",
    questionsToAskTitle: "Kluge Rückfragen an die Gesprächspartner",
    callNotesTitle: "Kurzspickzettel fürs Telefonat",
    logisticsAvailability: "Verfügbarkeit",
    logisticsNotice: "Kündigungsfrist",
    logisticsWorkMode: "Arbeitsmodell",
  },
  Spanish: {
    title: "Guía Dinámica de Entrevista y Estrategia STAR",
    subtitlePrefix: "Preparación a medida para",
    positioningTitle: "Pitch de 30 Segundos y Enfoque Estratégico",
    keywordsLabel: "Keywords ATS Prioritarias",
    concernsTitle: "Objeciones del Recruiter y Respuestas Exactas",
    neutralizeLabel: "CÓMO NEUTRALIZAR",
    phraseLabel: "FRASE EXACTA PARA DECIR",
    storiesTitle: "Historias STAR Adaptadas al Puesto",
    relevanceLabel: "Conexión con el puesto",
    salaryTitle: "Posicionamiento Salarial y Guion de Anclaje",
    recommendedRange: "Rango Objetivo",
    safeFloor: "Mínimo privado",
    ambitiousAnchor: "Ancla Ambiciosa",
    anchorScript: "GUION VERBAL DE ANCLAJE",
    sourceLabel: "Cita original de la fuente",
    keywordsInline: "Términos coincidentes",
    situationLabel: "SITUACIÓN",
    taskLabel: "TAREA",
    actionLabel: "ACCIÓN",
    resultLabel: "RESULTADO",
    privateNote: "Nota privada de preparación — no forma parte del guion hablado",
    fitLabel: "Encaje registrado",
    careerArcTitle: "Hilo conductor de tu trayectoria",
    questionsToAskTitle: "Preguntas inteligentes para hacer al entrevistador",
    callNotesTitle: "Guía rápida para llamada de cribado",
    logisticsAvailability: "Disponibilidad",
    logisticsNotice: "Preaviso",
    logisticsWorkMode: "Modalidad",
  },
};

export const StarPrepGuide: React.FC<TemplateProps> = ({ data }) => {
  const accentColor = data.templateSettings?.accentColor || "#10233f";
  const fontFamily = data.templateSettings?.fontFamily || "Inter";
  const prep = buildStarPrepData(data);
  const labels = PREP_LABELS[prep.lang];
  const fitScore = data.fitAssessment?.scoreOutOf10;
  const applyDecision = data.fitAssessment?.applyOrSkip;
  const roleType = data.roleClassification?.type;
  const logisticsItems = [
    data.cvContent?.header?.availability?.trim() ? { label: labels.logisticsAvailability, value: data.cvContent.header.availability.trim() } : null,
    data.formFieldAnswers?.noticePeriod?.trim() ? { label: labels.logisticsNotice, value: data.formFieldAnswers.noticePeriod.trim() } : null,
    data.workModel?.trim() ? { label: labels.logisticsWorkMode, value: data.workModel.trim() } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <div
      id="prep-template-star"
      style={{
        boxSizing: "border-box",
        width: "210mm",
        minHeight: "297mm",
        padding: "15mm 16mm",
        backgroundColor: "#ffffff",
        color: "#1f2937",
        fontFamily: `${fontFamily}, Arial, sans-serif`,
        fontSize: "9pt",
        lineHeight: "1.38",
        margin: "0 auto",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: `2px solid ${accentColor}`,
          paddingBottom: "8px",
          marginBottom: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "12px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "15pt", fontWeight: "bold", color: accentColor, margin: "0 0 2px 0" }}>
            {labels.title}
          </h1>
          <div style={{ fontSize: "9pt", color: "#4b5563" }}>
            {labels.subtitlePrefix} <strong>{data.roleTitle}</strong> · <strong>{data.company}</strong>
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {fitScore !== null && fitScore !== undefined && (
            <span
              style={{
                fontSize: "8pt",
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: "4px",
                backgroundColor: `${accentColor}12`,
                color: accentColor,
                border: `1px solid ${accentColor}30`,
              }}
            >
              {labels.fitLabel} {fitScore.toFixed(1)}/10 {applyDecision ? `· ${prep.applyDecisionLabel}` : ""}
            </span>
          )}
          {roleType && (
            <span
              style={{
                fontSize: "8pt",
                fontWeight: 600,
                padding: "2px 7px",
                borderRadius: "4px",
                backgroundColor: "#f3f4f6",
                color: "#374151",
                border: "1px solid #d1d5db",
              }}
            >
              {prep.roleTypeLabel}
            </span>
          )}
        </div>
      </div>

      {/* Section 1: 30-Second Pitch & Strategic Focus */}
      <div
        className="break-avoid"
        style={{
          marginBottom: "12px",
          backgroundColor: `${accentColor}08`,
          padding: "9px 11px",
          borderRadius: "6px",
          border: `1px solid ${accentColor}20`,
        }}
      >
        <div style={{ fontSize: "8pt", fontWeight: 700, color: accentColor, textTransform: "uppercase", marginBottom: "4px", letterSpacing: "0.4px" }}>
          {labels.positioningTitle}
        </div>
        <p style={{ margin: "0 0 6px 0", fontSize: "8.7pt", color: "#1f2937", lineHeight: 1.4 }}>
          {renderRichText(prep.elevatorPitch, false)}
        </p>
        {prep.careerArcSummary && (
          <div style={{ margin: "5px 0", padding: "5px 8px", backgroundColor: "#ffffff", borderRadius: "4px", borderLeft: `2.5px solid ${accentColor}`, fontSize: "8.2pt", color: "#374151" }}>
            <strong style={{ color: accentColor }}>{labels.careerArcTitle}: </strong>
            {renderRichText(prep.careerArcSummary, false)}
          </div>
        )}
        {prep.bestAngles.length > 0 && (
          <ul style={{ margin: "4px 0 4px 0", paddingLeft: "15px", fontSize: "8.2pt", color: "#374151" }}>
            {prep.bestAngles.slice(0, 3).map((angle, i) => (
              <li key={i} style={{ marginBottom: "2px" }}>
                {renderRichText(angle, false)}
              </li>
            ))}
          </ul>
        )}
        {prep.mustIncludeKeywords.length > 0 && (
          <div style={{ marginTop: "6px", fontSize: "7.8pt", color: "#4b5563" }}>
            <strong>{labels.keywordsLabel}:</strong> {prep.mustIncludeKeywords.slice(0, 10).join(" · ")}
          </div>
        )}
        {logisticsItems.length > 0 && (
          <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "7.8pt", color: "#374151" }}>
            {logisticsItems.map((item) => (
              <span key={item.label} style={{ backgroundColor: "#ffffff", border: "1px solid #d1d5db", borderRadius: "4px", padding: "1px 6px" }}>
                <strong>{item.label}:</strong> {item.value}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Dynamic Recruiter Objections & Neutralizers */}
      {prep.concerns.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <h2
            style={{
              fontSize: "10pt",
              fontWeight: "bold",
              color: accentColor,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              margin: "0 0 6px 0",
              borderBottom: "1px solid #e5e7eb",
              paddingBottom: "3px",
            }}
          >
            {labels.concernsTitle}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {prep.concerns.map((item) => (
              <div
                key={item.id}
                className="break-avoid"
                style={{
                  border: "1px solid #fde68a",
                  backgroundColor: "#fffbeb",
                  borderRadius: "6px",
                  padding: "8px 10px",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "8.8pt", color: "#92400e", marginBottom: "3px" }}>
                  ⚠ {renderRichText(item.concern, false)}
                </div>
                <div style={{ fontSize: "8.2pt", color: "#4b5563", fontStyle: "italic", marginBottom: "4px" }}>
                  “{item.probeQuestion}”
                </div>
                {item.howToNeutralize && (
                  <div style={{ fontSize: "8.3pt", color: "#374151", marginBottom: item.sentenceToUse ? "4px" : 0 }}>
                    <strong style={{ color: accentColor }}>{labels.neutralizeLabel}:</strong> {renderRichText(item.howToNeutralize, false)}
                  </div>
                )}
                {item.sentenceToUse && (
                  <div
                    style={{
                      fontSize: "8.5pt",
                      color: "#065f46",
                      backgroundColor: "#ecfdf5",
                      borderLeft: "3px solid #10b981",
                      padding: "4px 8px",
                      borderRadius: "3px",
                    }}
                  >
                    <strong>{labels.phraseLabel}:</strong> &ldquo;{renderRichText(item.sentenceToUse, false)}&rdquo;
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Role-Tailored STAR Behavioral Stories */}
      <div style={{ marginBottom: "12px" }}>
        <h2
          style={{
            fontSize: "10pt",
            fontWeight: "bold",
            color: accentColor,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            margin: "0 0 6px 0",
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: "3px",
          }}
        >
          {labels.storiesTitle}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {prep.stories.map((story, idx) => {
            const actionEchoesSource = story.achievementSource && story.action.includes(story.achievementSource);
            const resultEchoesSource = story.achievementSource && story.result.includes(story.achievementSource) && actionEchoesSource;
            return (
            <div
              key={story.id}
              className="break-avoid"
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                padding: "9px 11px",
                backgroundColor: "#f9fafb",
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  fontSize: "9.3pt",
                  color: accentColor,
                  marginBottom: "4px",
                  display: "flex",
                  gap: "6px",
                }}
              >
                <span>#{idx + 1}</span>
                <span>{story.question}</span>
              </div>

              <div
                style={{
                  fontSize: "8pt",
                  color: "#6b7280",
                  fontStyle: "italic",
                  marginBottom: "6px",
                  borderLeft: "2px solid #6d8ead",
                  paddingLeft: "7px",
                }}
              >
                {!actionEchoesSource && <div>{labels.sourceLabel}: &ldquo;{renderRichText(story.achievementSource, false)}&rdquo;</div>}
                <div style={{ fontStyle: "normal", color: "#4b5563", marginTop: actionEchoesSource ? 0 : "2px" }}>
                  <strong>{labels.relevanceLabel}:</strong> {renderRichText(story.relevanceHint, false)}
                  {story.keywordsToWeave.length > 0 ? ` · ${labels.keywordsInline}: ${story.keywordsToWeave.join(", ")}` : ""}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "78px 1fr", gap: "3px 8px", fontSize: "8.5pt" }}>
                <span style={{ fontWeight: "bold", color: accentColor }}>{labels.situationLabel}:</span>
                <span style={{ color: "#374151" }}>{renderRichText(story.situation, false)}</span>

                <span style={{ fontWeight: "bold", color: accentColor }}>{labels.taskLabel}:</span>
                <span style={{ color: "#374151" }}>{renderRichText(story.task, false)}</span>

                <span style={{ fontWeight: "bold", color: accentColor }}>{labels.actionLabel}:</span>
                <span style={{ color: "#374151" }}>{renderRichText(story.action, false)}</span>

                <span style={{ fontWeight: "bold", color: accentColor }}>{labels.resultLabel}:</span>
                <span style={{ color: "#059669", fontWeight: 600 }}>
                  {resultEchoesSource
                    ? renderRichText(story.result.replace(story.achievementSource, "").replace(/[:\s“”"«»]+$/, "").trim() || story.result, false)
                    : renderRichText(story.result, false)}
                </span>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Section 4: Compensation Positioning & Salary Anchor Script */}
      {(prep.salaryDefense.hasSalaryData || prep.salaryDefense.privateNotes) && <div
        className="break-avoid"
        style={{
          border: `1px solid ${accentColor}30`,
          borderRadius: "6px",
          padding: "9px 11px",
          backgroundColor: "#f8fafc",
        }}
      >
        <div
          style={{
            fontSize: "9pt",
            fontWeight: "bold",
            color: accentColor,
            textTransform: "uppercase",
            letterSpacing: "0.4px",
            marginBottom: "6px",
          }}
        >
          {labels.salaryTitle}
        </div>
        {(prep.salaryDefense.recommendedRangeEUR ||
          prep.salaryDefense.safeNumberEUR ||
          prep.salaryDefense.ambitiousNumberEUR) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "6px", fontSize: "8.2pt" }}>
            {prep.salaryDefense.recommendedRangeEUR && (
              <span style={{ backgroundColor: "#ffffff", border: "1px solid #d1d5db", borderRadius: "4px", padding: "2px 7px" }}>
                <strong>{labels.recommendedRange}:</strong> {prep.salaryDefense.recommendedRangeEUR}
              </span>
            )}
            {prep.salaryDefense.safeNumberEUR && (
              <span style={{ backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "4px", padding: "2px 7px", color: "#065f46" }}>
                <strong>{labels.safeFloor}:</strong> {prep.salaryDefense.safeNumberEUR}
              </span>
            )}
            {prep.salaryDefense.ambitiousNumberEUR && (
              <span style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "4px", padding: "2px 7px", color: "#1e40af" }}>
                <strong>{labels.ambitiousAnchor}:</strong> {prep.salaryDefense.ambitiousNumberEUR}
              </span>
            )}
          </div>
        )}
        {prep.salaryDefense.anchorScript && <div
          style={{
            fontSize: "8.5pt",
            color: "#1f2937",
            backgroundColor: "#ffffff",
            borderLeft: `3px solid ${accentColor}`,
            padding: "6px 9px",
            borderRadius: "3px",
          }}
        >
          <div style={{ fontSize: "7.5pt", fontWeight: 700, color: accentColor, marginBottom: "2px" }}>
            {labels.anchorScript}
          </div>
          {renderRichText(prep.salaryDefense.anchorScript, false)}
        </div>}
        {prep.salaryDefense.privateNotes && (
          <p style={{ margin: "8px 0 0 0", fontSize: "7.8pt", color: "#6b7280", borderTop: "1px dashed #cbd5e1", paddingTop: "5px", lineHeight: 1.35 }}>
            <strong>{labels.privateNote}:</strong> {renderRichText(prep.salaryDefense.privateNotes, false)}
          </p>
        )}
      </div>}

      {(prep.questionsToAsk.length > 0 || prep.callSurvivalNotes.length > 0) && (
        <div className="break-avoid" style={{ marginTop: "12px", display: "grid", gridTemplateColumns: prep.questionsToAsk.length > 0 && prep.callSurvivalNotes.length > 0 ? "1fr 1fr" : "1fr", gap: "10px" }}>
          {prep.questionsToAsk.length > 0 && (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "6px", padding: "8px 10px", backgroundColor: "#f9fafb" }}>
              <div style={{ fontSize: "8pt", fontWeight: 700, color: accentColor, textTransform: "uppercase", marginBottom: "4px", letterSpacing: "0.4px" }}>
                {labels.questionsToAskTitle}
              </div>
              <ul style={{ margin: 0, paddingLeft: "14px", fontSize: "8.2pt", color: "#374151" }}>
                {prep.questionsToAsk.map((q, idx) => (
                  <li key={idx} style={{ marginBottom: "2.5px" }}>{renderRichText(q, false)}</li>
                ))}
              </ul>
            </div>
          )}
          {prep.callSurvivalNotes.length > 0 && (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "6px", padding: "8px 10px", backgroundColor: "#f9fafb" }}>
              <div style={{ fontSize: "8pt", fontWeight: 700, color: accentColor, textTransform: "uppercase", marginBottom: "4px", letterSpacing: "0.4px" }}>
                {labels.callNotesTitle}
              </div>
              <ul style={{ margin: 0, paddingLeft: "14px", fontSize: "8.2pt", color: "#374151" }}>
                {prep.callSurvivalNotes.map((n, idx) => (
                  <li key={idx} style={{ marginBottom: "2.5px" }}>{renderRichText(n, false)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Visual page break guide */}
      <PageBreakGuides topPaddingMm={15} netPageHeightMm={267} />
    </div>
  );
};
