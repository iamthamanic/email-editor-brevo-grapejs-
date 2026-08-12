/**
 * Toolbar text / highlight color: brand swatches, hex input, native picker.
 * Location: apps/editor/src/templates/ToolbarTextColor.tsx
 */

import { useEffect, useId, useState, type MouseEvent } from "react";
import { BRAND_PALETTE, normalizeHexColor } from "@email-template/email-components";
import { IconColorHighlight, IconColorText } from "./icons";

export type ToolbarColorMode = "fore" | "hilite";

interface ToolbarTextColorProps {
  mode?: ToolbarColorMode;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (hex: string) => void;
  preserveSelection?: (e: MouseEvent) => void;
}

const MODE_META: Record<
  ToolbarColorMode,
  { title: string; testId: string; defaultHex: string; clearLabel?: string }
> = {
  fore: {
    title: "Textfarbe",
    testId: "toolbar-color",
    defaultHex: "#171717",
  },
  hilite: {
    title: "Texthintergrund",
    testId: "toolbar-hilite",
    defaultHex: "#ffe066",
    clearLabel: "Hintergrund entfernen",
  },
};

export function ToolbarTextColor({
  mode = "fore",
  disabled = false,
  open,
  onOpenChange,
  onPick,
  preserveSelection,
}: ToolbarTextColorProps) {
  const meta = MODE_META[mode];
  const panelId = useId();
  const [hexDraft, setHexDraft] = useState(meta.defaultHex);
  const [active, setActive] = useState(meta.defaultHex);

  useEffect(() => {
    if (!open) return;
    setHexDraft(active);
  }, [open, active]);

  function applyColor(hex: string) {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return;
    setActive(normalized);
    setHexDraft(normalized);
    onPick(normalized);
  }

  function onHexCommit() {
    const normalized = normalizeHexColor(hexDraft);
    if (!normalized) {
      setHexDraft(active);
      return;
    }
    applyColor(normalized);
  }

  return (
    <div className={`ed-tb-color-wrap${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="ed-tb-color"
        title={meta.title}
        aria-label={meta.title}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        disabled={disabled}
        data-testid={meta.testId}
        onMouseDown={preserveSelection}
        onClick={() => onOpenChange(!open)}
      >
        <span className="ed-tb-color-icon" aria-hidden>
          {mode === "hilite" ? (
            <IconColorHighlight barColor={active} />
          ) : (
            <IconColorText barColor={active === "#171717" ? "#e11d2e" : active} />
          )}
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          className="ed-tb-color-panel"
          role="dialog"
          aria-label={`${meta.title} wählen`}
          data-testid={`${meta.testId}-panel`}
          onMouseDown={preserveSelection}
        >
          <p className="ed-tb-color-panel-label">Markenfarben</p>
          <div className="ed-tb-color-swatches" role="list">
            {BRAND_PALETTE.map((c) => (
              <button
                key={c.hex}
                type="button"
                role="listitem"
                className={`ed-tb-color-swatch${active.toLowerCase() === c.hex ? " is-active" : ""}`}
                style={{ backgroundColor: c.hex }}
                title={`${c.label} (${c.ral}) · ${c.hex}`}
                aria-label={`${c.label}, ${c.hex}`}
                data-testid={`${meta.testId}-brand-${c.hex.slice(1)}`}
                onMouseDown={preserveSelection}
                onClick={() => {
                  applyColor(c.hex);
                  onOpenChange(false);
                }}
              />
            ))}
            {mode === "hilite" ? (
              <button
                type="button"
                role="listitem"
                className="ed-tb-color-swatch ed-tb-color-swatch-clear"
                title={meta.clearLabel}
                aria-label={meta.clearLabel}
                data-testid="toolbar-hilite-clear"
                onMouseDown={preserveSelection}
                onClick={() => {
                  onPick("transparent");
                  onOpenChange(false);
                }}
              />
            ) : null}
          </div>

          <label className="ed-tb-color-hex-label" htmlFor={`${panelId}-hex`}>
            HEX
          </label>
          <div className="ed-tb-color-hex-row">
            <input
              id={`${panelId}-hex`}
              type="text"
              className="ed-tb-color-hex"
              value={hexDraft}
              spellCheck={false}
              autoComplete="off"
              placeholder="#4eb2e5"
              data-testid={`${meta.testId}-hex`}
              onMouseDown={preserveSelection}
              onChange={(e) => setHexDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onHexCommit();
                  onOpenChange(false);
                }
              }}
              onBlur={onHexCommit}
            />
            <input
              type="color"
              className="ed-tb-color-native"
              value={normalizeHexColor(active) ?? meta.defaultHex}
              title="Farbwähler"
              aria-label="Farbwähler"
              data-testid={`${meta.testId}-native`}
              onMouseDown={preserveSelection}
              onChange={(e) => applyColor(e.target.value)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
