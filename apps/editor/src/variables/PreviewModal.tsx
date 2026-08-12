/**
 * Full-size preview modal: sample-substituted HTML + test send tabs.
 * Location: apps/editor/src/variables/PreviewModal.tsx
 *
 * Inbox-like ~600px email canvas + mock contact picker (Brevo-style layout).
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  getSyncedHtml,
  type Editor,
} from "@email-template/editor-core";
import {
  listPreviewContacts,
  substituteParams,
  type PreviewContact,
} from "@email-template/email-variables";
import { sendTemplateTestEmail } from "../api/templatesApi";
import { IconDesktop, IconMobile } from "../templates/icons";
import {
  buildPreviewDoc,
  buildSendHtml,
  type PreviewDevice,
} from "./previewDoc";

type ModalTab = "preview" | "send-test";
type Device = PreviewDevice;

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  editor: Editor | null;
  /** Required when allowTestSend is true (template test API). */
  templateId?: string;
  subject: string;
  senderName?: string | null;
  senderEmail?: string | null;
  brevoTemplateId?: string | null;
  /** When false: preview + customer picker only (compose /email-editor). */
  allowTestSend?: boolean;
}

function DeviceBar({
  device,
  onChange,
}: {
  device: Device;
  onChange: (d: Device) => void;
}) {
  return (
    <div className="ed-preview-device-bar" role="group" aria-label="Gerät">
      <button
        type="button"
        className={device === "desktop" ? "is-active" : undefined}
        aria-pressed={device === "desktop"}
        onClick={() => onChange("desktop")}
      >
        <IconDesktop size={14} />
        <span>Desktop</span>
      </button>
      <button
        type="button"
        className={device === "mobile" ? "is-active" : undefined}
        aria-pressed={device === "mobile"}
        onClick={() => onChange("mobile")}
      >
        <IconMobile size={14} />
        <span>Mobil</span>
      </button>
    </div>
  );
}

export function PreviewModal({
  open,
  onClose,
  editor,
  templateId = "",
  subject,
  senderName,
  senderEmail,
  brevoTemplateId,
  allowTestSend = true,
}: PreviewModalProps) {
  const contacts = useMemo(() => listPreviewContacts(), []);
  const [tab, setTab] = useState<ModalTab>("preview");
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [filter, setFilter] = useState("");
  const [html, setHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState(subject);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");

  const [testEmails, setTestEmails] = useState("");
  const [usePublished, setUsePublished] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendOk, setSendOk] = useState<string | null>(null);

  const selected: PreviewContact | undefined =
    contacts.find((c) => c.id === contactId) ?? contacts[0];

  const filteredContacts = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.kundenId.toLowerCase().includes(q),
    );
  }, [contacts, filter]);

  useEffect(() => {
    if (!open) return;
    setTab("preview");
    setSendError(null);
    setSendOk(null);
    // Always start with first mock customer so params are filled
    if (contacts[0]) setContactId(contacts[0].id);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, contacts]);

  useEffect(() => {
    if (!open) {
      setHtml("");
      setError(null);
      setLoading(false);
      return;
    }
    if (!editor) {
      setError("Editor ist noch nicht bereit.");
      setHtml("");
      return;
    }
    if (!selected) {
      setError("Kein Mock-Kunde verfügbar.");
      setHtml("");
      return;
    }

    let cancelled = false;

    async function renderPreview() {
      setLoading(true);
      try {
        if (cancelled || !editor || !selected) return;
        const sample = selected.params;
        setPreviewSubject(
          substituteParams(subject || "", sample) || "(kein Betreff)",
        );
        const rawHtml = await getSyncedHtml(editor);
        if (cancelled) return;
        setHtml(
          buildPreviewDoc(rawHtml, editor.getCss() ?? "", sample, device),
        );
        setError(null);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Vorschau konnte nicht erzeugt werden",
          );
          setHtml("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void renderPreview();
    const onUpdate = () => {
      void renderPreview();
    };
    editor.on("update", onUpdate);

    return () => {
      cancelled = true;
      editor.off("update", onUpdate);
    };
  }, [open, editor, subject, selected, device]);

  async function handleSendTest(e: FormEvent) {
    e.preventDefault();
    setSendError(null);
    setSendOk(null);
    const emails = testEmails
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      setSendError("Bitte mindestens eine Empfänger-E-Mail angeben.");
      return;
    }
    if (!editor || !selected) {
      setSendError("Editor oder Beispieldaten fehlen.");
      return;
    }
    if (!templateId) {
      setSendError("Kein Template für Testversand ausgewählt.");
      return;
    }

    setSending(true);
    try {
      const result = await sendTemplateTestEmail(templateId, {
        emails,
        usePublishedTemplate: usePublished && Boolean(brevoTemplateId),
        subject: previewSubject,
        html: usePublished
          ? undefined
          : buildSendHtml(
              await getSyncedHtml(editor),
              editor.getCss() ?? "",
              selected.params,
            ),
      });
      setSendOk(
        result.mode === "brevo-template"
          ? `Test an ${result.recipientCount} Empfänger gesendet (Brevo-Template).`
          : `Test an ${result.recipientCount} Empfänger gesendet.`,
      );
    } catch (err: unknown) {
      setSendError(
        err instanceof Error ? err.message : "Testversand fehlgeschlagen",
      );
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const fromLabel =
    [senderName?.trim(), senderEmail?.trim()].filter(Boolean).join(" · ") ||
    "—";

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      data-testid="preview-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal ed-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ed-preview-title"
        data-testid="preview-modal"
      >
        <header className="modal-header ed-preview-modal-header">
          <div className="ed-preview-modal-heading">
            <h2 id="ed-preview-title">
              {allowTestSend ? "Vorschau & Test" : "Vorschau"}
            </h2>
            {allowTestSend && (
              <div
                className="ed-preview-tabs"
                role="tablist"
                aria-label="Vorschau-Modus"
              >
                <button
                  type="button"
                  role="tab"
                  id="ed-preview-tab-preview"
                  aria-selected={tab === "preview"}
                  aria-controls="ed-preview-panel-preview"
                  className={tab === "preview" ? "is-active" : undefined}
                  onClick={() => setTab("preview")}
                  data-testid="preview-tab-preview"
                >
                  Vorschau
                </button>
                <button
                  type="button"
                  role="tab"
                  id="ed-preview-tab-send"
                  aria-selected={tab === "send-test"}
                  aria-controls="ed-preview-panel-send"
                  className={tab === "send-test" ? "is-active" : undefined}
                  onClick={() => setTab("send-test")}
                  data-testid="preview-tab-send-test"
                >
                  Test-E-Mail senden
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label="Schließen"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {tab === "preview" || !allowTestSend ? (
          <div
            className="modal-body ed-preview-modal-body"
            role="tabpanel"
            id="ed-preview-panel-preview"
            aria-labelledby="ed-preview-tab-preview"
          >
            <div className="ed-preview-main">
              <div className="ed-preview-meta-row">
                <dl className="ed-preview-meta">
                  <div>
                    <dt>Von</dt>
                    <dd>{fromLabel}</dd>
                  </div>
                  <div>
                    <dt>Betreff</dt>
                    <dd data-testid="preview-subject">{previewSubject}</dd>
                  </div>
                </dl>
                <DeviceBar device={device} onChange={setDevice} />
              </div>

              <div
                className={`ed-preview-frame-wrap${device === "mobile" ? " is-mobile" : " is-desktop"}`}
              >
                {loading && !html && !error && (
                  <p className="muted" aria-busy="true">
                    Vorschau wird geladen…
                  </p>
                )}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                {!error && html && (
                  <iframe
                    className="ed-preview-frame"
                    title="E-Mail-Vorschau mit Beispieldaten"
                    sandbox=""
                    srcDoc={html}
                    data-testid="preview-frame"
                  />
                )}
              </div>
            </div>

            <aside className="ed-preview-side" data-testid="preview-side">
              <h3>Kunde auswählen</h3>
              <p className="muted">
                Suche nach Name, E-Mail oder Kundennummer. Platzhalter werden mit
                dessen Beispieldaten gefüllt.
              </p>

              <label className="ed-preview-search">
                <span className="visually-hidden">Kunde suchen</span>
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Name, E-Mail oder Kundennummer"
                  data-testid="preview-contact-search"
                />
              </label>

              <ul
                className="ed-preview-contact-list"
                role="listbox"
                aria-label="Testkunden"
                data-testid="preview-contact-list"
              >
                {filteredContacts.length === 0 && (
                  <li className="muted ed-preview-contact-empty">
                    Kein Kunde gefunden.
                  </li>
                )}
                {filteredContacts.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={c.id === selected?.id}
                      className={
                        c.id === selected?.id
                          ? "ed-preview-contact is-selected"
                          : "ed-preview-contact"
                      }
                      onClick={() => setContactId(c.id)}
                      data-testid={`preview-contact-${c.id}`}
                    >
                      <span className="ed-preview-contact-name">{c.label}</span>
                      <span className="ed-preview-contact-meta">
                        Kunden-Nr. {c.kundenId}
                      </span>
                      <span className="ed-preview-contact-email">{c.email}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <p className="ed-preview-side-note">
                Mock-Kunden (keine Live-CRM-Anbindung).
              </p>
            </aside>
          </div>
        ) : (
          <div
            className="modal-body ed-preview-send-body"
            role="tabpanel"
            id="ed-preview-panel-send"
            aria-labelledby="ed-preview-tab-send"
            data-testid="preview-send-panel"
          >
            <div className="ed-preview-main ed-preview-send-main">
              <div className="ed-preview-meta-row">
                <dl className="ed-preview-meta">
                  <div>
                    <dt>Von</dt>
                    <dd>{fromLabel}</dd>
                  </div>
                  <div>
                    <dt>Betreff</dt>
                    <dd>{previewSubject}</dd>
                  </div>
                </dl>
                <DeviceBar device={device} onChange={setDevice} />
              </div>

              <div
                className={`ed-preview-frame-wrap${device === "mobile" ? " is-mobile" : " is-desktop"}`}
              >
                {loading && !html && !error && (
                  <p className="muted" aria-busy="true">
                    Vorschau wird geladen…
                  </p>
                )}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                {!error && html && (
                  <iframe
                    className="ed-preview-frame"
                    title="E-Mail-Vorschau (Test senden)"
                    sandbox=""
                    srcDoc={html}
                    data-testid="preview-send-frame"
                  />
                )}
              </div>
            </div>

            <aside className="ed-preview-side ed-preview-send-side">
              <h3>An wen soll der Test gehen?</h3>
              <p className="muted">
                Eine oder mehrere Adressen, getrennt durch Komma oder Zeilenumbruch.
              </p>
              <form onSubmit={(ev) => void handleSendTest(ev)}>
                <label className="ed-field">
                  <span>Empfänger *</span>
                  <textarea
                    value={testEmails}
                    onChange={(e) => setTestEmails(e.target.value)}
                    rows={4}
                    placeholder="name@firma.de"
                    data-testid="preview-send-emails"
                    disabled={sending}
                  />
                </label>

                {brevoTemplateId != null && brevoTemplateId !== "" && (
                  <label className="ed-preview-send-check">
                    <input
                      type="checkbox"
                      checked={usePublished}
                      onChange={(e) => setUsePublished(e.target.checked)}
                      disabled={sending}
                    />
                    <span>
                      Stattdessen publiziertes Brevo-Template #{brevoTemplateId}{" "}
                      testen
                    </span>
                  </label>
                )}

                {sendError && (
                  <p className="error" role="alert">
                    {sendError}
                  </p>
                )}
                {sendOk && (
                  <p className="ed-preview-send-ok" role="status">
                    {sendOk}
                  </p>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={sending}
                  data-testid="preview-send-submit"
                >
                  {sending ? "Wird gesendet…" : "Test senden"}
                </button>
              </form>
            </aside>
          </div>
        )}

        <footer className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Schließen
          </button>
        </footer>
      </div>
    </div>
  );
}
