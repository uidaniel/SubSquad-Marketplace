-- ============================================================================
-- Where signed contracts live.
--
-- Private. A contract carries the creator's phone number and the IP address
-- they signed from, which is exactly the evidence that makes it enforceable and
-- exactly the sort of thing that should not sit behind a guessable URL.
--
-- Reached through short-lived signed URLs instead, issued to the two parties
-- who are on the deal.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contracts', 'contracts', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects are keyed `<deal_id>/<reference>.pdf`, so the deal id is the first
-- path segment and this join is cheap.
create policy "Deal participants read contracts"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'contracts'
    and exists (
      select 1
      from public.deals d
      left join public.creators c on c.id = d.creator_id
      left join public.campaigns ca on ca.id = d.campaign_id
      where d.id::text = (storage.foldername(name))[1]
        and (c.user_id = auth.uid() or public.is_org_member(ca.org_id))
    )
  );

-- Written only by the server when a creator accepts, so there is deliberately
-- no insert policy for authenticated users.
