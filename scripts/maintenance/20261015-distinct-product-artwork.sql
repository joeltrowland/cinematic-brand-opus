-- Owner-requested product artwork refresh; not a member schema migration.
-- Publish and verify both new assets before applying this transaction.
-- Keep the hero, PushTen, offer text, pricing, and destinations unchanged.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';

LOCK TABLE public.site_settings IN SHARE MODE;
-- Match the offer editor's graph-lock-before-row-lock ordering.
SELECT pg_advisory_xact_lock(671149920);

DO $$
DECLARE
  expected record;
  current_offer record;
BEGIN
  IF (SELECT count(*) FROM public.site_settings) <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.site_settings
    WHERE site_url = 'https://brianhanson.com'
      AND author_name = 'Brian Hanson'
      AND site_name = 'Brian Hanson'
  ) THEN
    RAISE EXCEPTION 'This artwork belongs only to the Brian Hanson owner site';
  END IF;

  -- Lock and validate every target before changing either cover. A concurrent
  -- editor change aborts the transaction; an already applied refresh is a no-op.
  FOR expected IN
    SELECT * FROM (VALUES
      ('6689db7a-432b-41d9-8b73-2f89c32c67b4'::uuid,
       'app-building-workshop',
       'https://brianhanson.com/shop/app-building-workshop-v2.png',
       'https://brianhanson.com/shop/app-building-workshop-v3.webp',
       '2026-10-04 07:20:19.030725+00'::timestamptz),
      ('7919a6b8-bb80-4fd4-9951-4ae44132d5f9'::uuid,
       'personal-agent-webinar',
       'https://brianhanson.com/shop/personal-agent-webinar-v1.png',
       'https://brianhanson.com/shop/personal-agent-webinar-v2.webp',
       '2026-10-04 07:47:43.145152+00'::timestamptz)
    ) AS targets(id, slug, previous_cover, intended_cover, expected_updated_at)
    ORDER BY id
  LOOP
    SELECT id, slug, cover_url, updated_at INTO current_offer
    FROM public.offers WHERE id = expected.id FOR UPDATE;

    IF NOT FOUND OR current_offer.slug IS DISTINCT FROM expected.slug THEN
      RAISE EXCEPTION 'Expected offer % is missing or has changed slug', expected.slug;
    END IF;
    IF current_offer.cover_url IS DISTINCT FROM expected.intended_cover AND (
      current_offer.cover_url IS DISTINCT FROM expected.previous_cover OR
      current_offer.updated_at IS DISTINCT FROM expected.expected_updated_at
    ) THEN
      RAISE EXCEPTION 'Offer % has changed; inspect rather than overwrite', expected.slug;
    END IF;
  END LOOP;

  UPDATE public.offers SET
    cover_url = 'https://brianhanson.com/shop/app-building-workshop-v3.webp'
  WHERE id = '6689db7a-432b-41d9-8b73-2f89c32c67b4'
    AND slug = 'app-building-workshop'
    AND cover_url = 'https://brianhanson.com/shop/app-building-workshop-v2.png';

  UPDATE public.offers SET
    cover_url = 'https://brianhanson.com/shop/personal-agent-webinar-v2.webp'
  WHERE id = '7919a6b8-bb80-4fd4-9951-4ae44132d5f9'
    AND slug = 'personal-agent-webinar'
    AND cover_url = 'https://brianhanson.com/shop/personal-agent-webinar-v1.png';
END $$;

-- The existing offers trigger maintains updated_at on changed rows.
COMMIT;
