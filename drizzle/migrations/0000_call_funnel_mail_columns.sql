alter table public.call_funnel_applications
  add column if not exists owner_alerted_at timestamptz,
  add column if not exists followup_sent_at timestamptz;
update public.call_funnel_applications
  set owner_alerted_at = coalesce(owner_alerted_at, now()),
      followup_sent_at = coalesce(followup_sent_at, now());
create index if not exists call_applications_mail_idx
  on public.call_funnel_applications(submitted_at)
  where outcome = 'qualified' and (owner_alerted_at is null or followup_sent_at is null);