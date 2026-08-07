/**
 * Template info modal: Tabs Logs + Statistik (CSV download).
 * Location: apps/editor/src/templates/TemplateInfoModal.tsx
 */

import { useEffect, useState } from "react";
import type {
  EmailTemplateListItem,
  TemplateInsightsDto,
} from "@email-template/email-schema";
import {
  fetchTemplateInsights,
  templateStatisticsCsvUrl,
} from "../api/templatesApi";

type TabId = "logs" | "stats";

interface TemplateInfoModalProps {
  item: EmailTemplateListItem | null;
  onClose: () => void;
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function actionLabel(action: string): string {
  if (action === "created") return "Angelegt";
  if (action === "updated") return "Bearbeitet";
  return action;
}

export function TemplateInfoModal({ item, onClose }: TemplateInfoModalProps) {
  const [tab, setTab] = useState<TabId>("logs");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<TemplateInsightsDto | null>(null);

  useEffect(() => {
    if (!item) return;
    setTab("logs");
    setInsights(null);
    setError(null);
    setLoading(true);
    let cancelled = false;
    fetchTemplateInsights(item.id)
      .then((data) => {
        if (!cancelled) setInsights(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Laden fehlgeschlagen");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  useEffect(() => {
    if (!item) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal tpl-info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tpl-info-title"
        data-testid="template-info-modal"
      >
        <header className="modal-header">
          <h2 id="tpl-info-title">Informationen</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Schließen"
          >
            ×
          </button>
        </header>

        <div className="modal-body">
          <p className="tpl-info-subtitle muted">{item.name}</p>

          <div className="tpl-info-tabs" role="tablist" aria-label="Informationen">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "logs"}
              className={`tpl-info-tab${tab === "logs" ? " is-active" : ""}`}
              data-testid="template-info-tab-logs"
              onClick={() => setTab("logs")}
            >
              Logs
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "stats"}
              className={`tpl-info-tab${tab === "stats" ? " is-active" : ""}`}
              data-testid="template-info-tab-stats"
              onClick={() => setTab("stats")}
            >
              Statistik
            </button>
          </div>

          {loading && (
            <p className="muted" aria-busy="true">
              Wird geladen…
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {!loading && !error && insights && tab === "logs" && (
            <div role="tabpanel" data-testid="template-info-logs">
              {insights.logs.length === 0 ? (
                <p className="muted">Noch keine Bearbeitungs-Logs.</p>
              ) : (
                <ul className="tpl-info-list">
                  {insights.logs.map((log) => (
                    <li key={log.id} className="tpl-info-row">
                      <div className="tpl-info-row-main">
                        <strong>{log.actorDisplayName}</strong>
                        <span className="muted">
                          {actionLabel(log.action)} · Rev {log.revision}
                        </span>
                      </div>
                      <span className="muted tpl-info-when">
                        {formatWhen(log.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!loading && !error && insights && tab === "stats" && (
            <div role="tabpanel" data-testid="template-info-stats">
              <div className="tpl-info-stats-toolbar">
                <p className="tpl-info-stats-count">
                  {insights.sendCount === 0
                    ? "Noch keine Versände"
                    : `${insights.sendCount} Versände`}
                </p>
                <a
                  className="btn-secondary"
                  href={templateStatisticsCsvUrl(item.id)}
                  download
                  data-testid="template-stats-csv"
                >
                  CSV herunterladen
                </a>
              </div>
              {insights.sendEvents.length === 0 ? (
                <p className="muted">
                  Keine Empfängerdaten. Versandstatistik wird später aus Brevo
                  synchronisiert.
                </p>
              ) : (
                <ul className="tpl-info-list">
                  {insights.sendEvents.map((ev) => (
                    <li key={ev.id} className="tpl-info-row">
                      <div className="tpl-info-row-main">
                        <strong>{ev.recipientEmail}</strong>
                        <span className="muted">
                          {ev.recipientName?.trim() || "—"} · {ev.status}
                        </span>
                      </div>
                      <span className="muted tpl-info-when">
                        {formatWhen(ev.sentAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <footer className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            data-testid="template-info-close"
            onClick={onClose}
          >
            Schließen
          </button>
        </footer>
      </div>
    </div>
  );
}
