/**
 * App routes: template list, template editor, compose email.
 * Location: apps/editor/src/App.tsx
 */

import { Navigate, Route, Routes } from "react-router";
import { EmailComposePage } from "./compose/EmailComposePage";
import { TemplateListPage } from "./templates/TemplateListPage";
import { TemplateEditorPage } from "./templates/TemplateEditorPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<TemplateListPage />} />
      <Route path="/templates/:id" element={<TemplateEditorPage />} />
      <Route path="/email-editor" element={<EmailComposePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
