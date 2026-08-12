-- Persistent editor schema version + conversion meta (survives Grapes autosave).
-- TemplateVersion snapshots for pre-migration backup.

ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "editor_schema_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "conversion_meta" JSONB;

CREATE TABLE IF NOT EXISTS "template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "editor_data" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "template_versions_template_id_created_at_idx"
  ON "template_versions"("template_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'template_versions_template_id_fkey'
  ) THEN
    ALTER TABLE "template_versions"
      ADD CONSTRAINT "template_versions_template_id_fkey"
      FOREIGN KEY ("template_id") REFERENCES "email_templates"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
