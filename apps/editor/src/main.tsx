/**
 * Editor app entry.
 * Location: apps/editor/src/main.tsx
 */

import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { applyEmbedModeFromUrl } from "./theme/applyHostChrome";
import "@email-template/theme-contract/tokens.css";
import "grapesjs/dist/css/grapes.min.css";
import "./styles.css";

// ponytail: no StrictMode — GrapesJS breaks on double mount/destroy

applyEmbedModeFromUrl();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
