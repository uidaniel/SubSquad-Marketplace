-- ============================================================================
-- Where draft videos live.
--
-- Private, not public. A draft is unpublished work for a brand that has not yet
-- approved it — leaking one early is a real commercial harm, and the creator
-- has not agreed to it being visible to anyone but the people on the deal.
--
-- Files are reached through short-lived signed URLs instead: the creator gets a
-- signed upload URL scoped to one path, and the agency gets a signed download
-- URL that expires. Nothing in this bucket is readable by URL alone.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'drafts',
  'drafts',
  false,
  -- 200MB. A minute of phone video is comfortably inside it, and the cap stops
  -- an accidental 4K export from eating a creator's data plan and our storage.
  209715200,
  array[
    'video/mp4',
    'video/quicktime',
    'video/x-m4v',
    'video/webm',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Who can read a draft.
--
-- The creator who made it, and the members of the org running the campaign.
-- Objects are keyed `drafts/<deal_id>/<version>-<random>.<ext>`, so the deal id
-- is the first path segment and the join below is cheap.
-- ---------------------------------------------------------------------------
create policy "Deal participants read drafts"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'drafts'
    and exists (
      select 1
      from public.deals d
      left join public.creators c on c.id = d.creator_id
      left join public.campaigns ca on ca.id = d.campaign_id
      where d.id::text = (storage.foldername(name))[1]
        and (
          c.user_id = auth.uid()
          or public.is_org_member(ca.org_id)
        )
    )
  );

-- Writes never come from a browser session — the creator has an invite token,
-- not an account — so uploads go through a server-issued signed URL and there
-- is deliberately no insert policy for `authenticated`.
