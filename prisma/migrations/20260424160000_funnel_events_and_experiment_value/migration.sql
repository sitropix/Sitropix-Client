-- AlterTable
ALTER TABLE "feature_flags" ADD COLUMN "string_value" VARCHAR(120);

-- CreateTable
CREATE TABLE "funnel_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "props" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "funnel_events_name_created_at_idx" ON "funnel_events"("name", "created_at");

-- CreateIndex
CREATE INDEX "funnel_events_user_id_created_at_idx" ON "funnel_events"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
