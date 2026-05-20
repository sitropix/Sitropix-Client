-- Store uploaded document bytes in PostgreSQL (legacy filesystem paths remain readable).
ALTER TABLE "client_documents" ADD COLUMN "file_data" BYTEA;
ALTER TABLE "ticket_attachments" ADD COLUMN "file_data" BYTEA;
