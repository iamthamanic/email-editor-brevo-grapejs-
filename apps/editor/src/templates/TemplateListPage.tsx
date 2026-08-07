/**
 * Template list page with create CTA and empty state (DE).
 * Location: apps/editor/src/templates/TemplateListPage.tsx
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { EmailTemplateListItem } from "@email-template/email-schema";
import { createTemplate, fetchTemplates } from "../api/templatesApi";

export function TemplateListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<EmailTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTemplates()
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setError(null);
        }
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
  }, []);

  async function onCreate() {
    setCreating(true);
    setError(null);
    try {
      const created = await createTemplate({ name: "Neues Template" });
      navigate(`/templates/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Anlegen fehlgeschlagen");
      setCreating(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Email Template Service</p>
          <h1>E-Mail Templates</h1>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={onCreate}
          disabled={creating}
        >
          {creating ? "Wird angelegt…" : "Neues Template"}
        </button>
      </header>

      {loading && <p className="muted" aria-busy="true">Templates werden geladen…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="empty">
          <h2>Noch keine Templates</h2>
          <p className="muted">Lege das erste Template an, um den Editor zu testen.</p>
          <button type="button" className="btn-primary" onClick={onCreate} disabled={creating}>
            Erstes Template anlegen
          </button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <ul className="template-list">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={`/templates/${item.id}`} className="template-card">
                <span className="template-name">{item.name}</span>
                <span className="muted">
                  {item.status} · Rev {item.revision}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
