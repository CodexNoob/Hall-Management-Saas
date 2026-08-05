-- CreateTable
CREATE TABLE "bank_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "plaid_item_id" TEXT NOT NULL,
    "plaid_access_token" TEXT NOT NULL,
    "institution_id" TEXT,
    "institution_name" TEXT,
    "account_id" TEXT,
    "account_name" TEXT,
    "account_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "bank_connection_id" UUID NOT NULL,
    "plaid_transaction_id" TEXT,
    "account_id" TEXT,
    "description" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "transaction_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_connections_organization_id_status_idx" ON "bank_connections"("organization_id", "status");

-- CreateIndex
CREATE INDEX "bank_transactions_organization_id_transaction_date_idx" ON "bank_transactions"("organization_id", "transaction_date");

-- CreateIndex
CREATE INDEX "bank_transactions_bank_connection_id_transaction_date_idx" ON "bank_transactions"("bank_connection_id", "transaction_date");

-- AddForeignKey
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_connection_id_fkey" FOREIGN KEY ("bank_connection_id") REFERENCES "bank_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddUniqueConstraint
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_organization_id_plaid_item_id_key" UNIQUE ("organization_id", "plaid_item_id");
