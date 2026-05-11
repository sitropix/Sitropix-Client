-- Persist Cal.com booking payload from API (after successful embed booking).
ALTER TABLE "form_submissions" ADD COLUMN IF NOT EXISTS "cal_meeting_details_json" JSONB;
