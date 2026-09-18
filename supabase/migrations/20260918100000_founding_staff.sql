-- ---------------------------------------------------------------------------
-- The first member of staff.
--
-- platform_staff had no rows. Every route under /ops checks is_staff(), so the
-- ops console — verification queue, disputes, failed payouts, stuck webhooks —
-- was a 404 for every person on earth, including the founder, while the
-- sidebar went on linking to it.
--
-- Staff membership is granted in the database by someone who already has it,
-- or, once, like this. There is no self-serve path in, and there must not be.
-- ---------------------------------------------------------------------------

insert into public.platform_staff (user_id, role, note)
select id, 'admin', 'Founder'
  from auth.users
 where email = 'dannycodesltd@gmail.com'
on conflict (user_id) do update set role = 'admin';
