-- Audit logs + send events for template insights modal
CREATE TABLE "template_audit_logs" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "actor_display_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "template_send_events" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "recipient_name" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "source" TEXT NOT NULL DEFAULT 'LOCAL',

    CONSTRAINT "template_send_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "template_audit_logs_template_id_created_at_idx" ON "template_audit_logs"("template_id", "created_at");
CREATE INDEX "template_send_events_template_id_sent_at_idx" ON "template_send_events"("template_id", "sent_at");

ALTER TABLE "template_audit_logs" ADD CONSTRAINT "template_audit_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "email_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_send_events" ADD CONSTRAINT "template_send_events_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "email_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
