-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "brevo_template_id" BIGINT,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "sender_name" TEXT,
    "sender_email" TEXT,
    "reply_to" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'LOCAL',
    "editor_data" JSONB NOT NULL,
    "published_html" TEXT,
    "published_editor_data" JSONB,
    "brevo_modified_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_brevo_template_id_key" ON "email_templates"("brevo_template_id");
