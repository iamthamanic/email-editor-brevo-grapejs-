/**
 * Shared HTML doc builder for email preview iframes.
 * Location: apps/editor/src/variables/previewDoc.ts
 */

import { substituteParams, type SampleData } from "@email-template/email-variables";
import { EMAIL_FONT_STACK } from "@email-template/email-components";

export type PreviewDevice = "desktop" | "mobile";

/** Standard email content width (clients + our editor canvas). */
export const EMAIL_CANVAS_PX = 600;

/**
 * Inbox-like document: gray page + white 600px email canvas.
 */
export function buildPreviewDoc(
  rawHtml: string,
  componentCss: string,
  sample: SampleData,
  device: PreviewDevice,
): string {
  const body = substituteParams(rawHtml, sample);
  const safeCss = componentCss.replace(/<\/style/gi, "<\\/style");
  const canvasWidth =
    device === "mobile"
      ? `width:100%;max-width:${EMAIL_CANVAS_PX}px;`
      : `width:${EMAIL_CANVAS_PX}px;max-width:${EMAIL_CANVAS_PX}px;`;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  html, body { margin: 0; padding: 0; height: 100%; }
  body {
    background: #eceff2;
    font-family: ${EMAIL_FONT_STACK};
    -webkit-text-size-adjust: 100%;
  }
  .ets-preview-shell {
    box-sizing: border-box;
    width: 100%;
    min-height: 100%;
    padding: 20px 12px 32px;
  }
  .ets-preview-canvas {
    ${canvasWidth}
    margin: 0 auto;
    background: #ffffff;
  }
  .ets-preview-canvas img {
    max-width: 100%;
    height: auto;
  }
  .ets-preview-canvas > table,
  .ets-preview-canvas table[data-email-type="email-section"],
  .ets-preview-canvas [data-email-type="email-section"] {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box;
  }
  .ets-preview-canvas [data-email-type="email-row"] {
    width: 100% !important;
  }
  ${safeCss}
</style>
</head>
<body>
  <div class="ets-preview-shell">
    <div class="ets-preview-canvas">${body}</div>
  </div>
</body>
</html>`;
}

export function buildSendHtml(
  rawHtml: string,
  css: string,
  sample: SampleData,
): string {
  const body = substituteParams(rawHtml, sample);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${css}</style></head><body>${body}</body></html>`;
}

/**
 * Publish payload: keep Brevo merge tags; wrap Grapes body + component CSS.
 */
export function buildPublishHtml(rawHtml: string, css: string): string {
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>${safeCss}</style></head><body>${rawHtml}</body></html>`;
}
