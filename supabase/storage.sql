-- PigSync — Fase 3: bucket de fotos pra contagem por IA

insert into storage.buckets (id, name, public)
values ('contagens', 'contagens', false)
on conflict (id) do nothing;

create policy "authenticated_upload_contagens" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'contagens');

create policy "authenticated_read_contagens" on storage.objects
  for select to authenticated
  using (bucket_id = 'contagens');
