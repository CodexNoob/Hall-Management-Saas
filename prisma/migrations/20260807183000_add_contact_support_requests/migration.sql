CREATE TABLE "contact_support_requests" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'public_contact_form',
    "page_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contact_support_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_support_requests_reference_key" ON "contact_support_requests"("reference");
CREATE INDEX "contact_support_requests_status_created_at_idx" ON "contact_support_requests"("status", "created_at");
CREATE INDEX "contact_support_requests_email_created_at_idx" ON "contact_support_requests"("email", "created_at");
