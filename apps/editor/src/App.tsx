/**
 * App routes: template list + editor.
 * Location: apps/editor/src/App.tsx
 */

import { Navigate, Route, Routes } from "react-router";
import { TemplateListPage } from "./templates/TemplateListPage";
import { TemplateEditorPage } from "./templates/TemplateEditorPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<TemplateListPage />} />
      <Route path="/templates/:id" element={<TemplateEditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
