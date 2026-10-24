-- Call funnel email: an instant owner alert for each qualified application and
-- one booking reminder for qualified applicants who have not booked.
-- Timestamps are written only after Resend confirms acceptance.
alter table public.call_funnel_applications
  add column if not exists owner_alerted_at timestamptz,
  add column if not exists followup_sent_at timestamptz;

create index if not exists call_applications_mail_idx
  on public.call_funnel_applications(submitted_at)
  where outcome = 'qualified' and (owner_alerted_at is null or followup_sent_at is null);

-- Every 15 minutes. Unschedule with: SELECT cron.unschedule('call-funnel-mail-15min');
DO $$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'call-funnel-mail-15min') THEN
    PERFORM cron.unschedule('call-funnel-mail-15min');
  END IF;
  PERFORM cron.schedule(
    'call-funnel-mail-15min',
    '*/15 * * * *',
    $cmd$
  SELECT net.http_post(timeout_milliseconds := 60000,
    url := 'https://pwjdotliwsulqktavyxf.supabase.co/functions/v1/call-funnel-mail',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_INVOCATION_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $cmd$
  );
END $$;
