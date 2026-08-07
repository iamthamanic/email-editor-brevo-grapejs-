-- CreateTable
CREATE TABLE "email_saved_sections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "section_data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_saved_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_saved_sections_role_idx" ON "email_saved_sections"("role");
