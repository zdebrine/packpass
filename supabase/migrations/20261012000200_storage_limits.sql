-- Storage › Bucket limits. The private buckets were created without a size cap or allowed types, so storage took
-- whatever a client sent (supabase/config.toml's 10MiB only applies to the local stack). A broken web upload wrote
-- 42-byte "PDFs" that admins couldn't open. Each bucket now takes only what the apps upload, up to 10 MB:
--   dog-photos    JPEG dog photos (apps/member/src/lib/photos.ts)
--   vaccine-docs  a vet record PDF or JPEG photo of it (apps/member/src/lib/records.ts)
--   partner-docs  partner application documents, PDF/JPG/PNG (apps/partner/src/lib/api.ts uploadApplicationDoc)
-- Existing files are untouched.

update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'dog-photos';
update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
where id = 'vaccine-docs';
update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
where id = 'partner-docs';
