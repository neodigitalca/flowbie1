-- Remove legacy unified registry (one table per client only: content_bank_<site>).
-- Replaces old RPC name with flowbie_ensure_content_bank (same body as 20260515100000).

DROP TABLE IF EXISTS public.flowbie_unified_content_bank_registry CASCADE;

DROP FUNCTION IF EXISTS public.flowbie_ensure_unified_content_bank(text, text);

CREATE OR REPLACE FUNCTION public.flowbie_ensure_content_bank(
  p_site_key text,
  p_display_label text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_tail text;
  v_name text;
  ddl text;
BEGIN
  v_key := trim(both from coalesce(p_site_key, ''));
  IF length(v_key) < 2 OR length(v_key) > 120 THEN
    RAISE EXCEPTION 'invalid site id length';
  END IF;
  IF v_key !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]*$' THEN
    RAISE EXCEPTION 'invalid site id characters';
  END IF;

  v_tail := trim(both '_' from regexp_replace(lower(v_key), '[^a-z0-9]+', '_', 'g'));
  v_name := 'content_bank_' || v_tail;

  IF v_name = 'content_bank_' OR length(v_name) > 63 OR v_name !~ '^content_bank_[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'invalid content bank table name: %', v_name;
  END IF;

  ddl := format(
    $c$
    CREATE TABLE IF NOT EXISTS public.%I (
      id bigserial PRIMARY KEY,
      client_name text NOT NULL DEFAULT '',
      content_type text NOT NULL,
      title text NOT NULL,
      excerpt text,
      html_content text NOT NULL,
      markdown_content text,
      slug text,
      wordpress_status text NOT NULL DEFAULT 'future',
      scheduled_date_gmt timestamptz,
      categories text,
      tags text,
      featured_image_url text,
      menu_order integer NOT NULL DEFAULT 0,
      post_type_endpoint text NOT NULL DEFAULT 'posts',
      sitemap_type text,
      featured_media_id bigint,
      featured_image_meta jsonb,
      acf_payload jsonb,
      keyword text,
      entity text,
      source_row jsonb,
      status text NOT NULL DEFAULT 'pending',
      wp_post_id bigint,
      wp_link text,
      published_at timestamptz,
      last_error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT %I CHECK (content_type IN ('post', 'entity')),
      CONSTRAINT %I CHECK (sitemap_type IS NULL OR sitemap_type IN ('post', 'entity')),
      CONSTRAINT %I CHECK (status IN ('pending', 'publishing', 'published', 'failed')),
      CONSTRAINT %I CHECK (wordpress_status IN ('draft', 'future', 'publish'))
    )
    $c$,
    v_name,
    v_name || '_content_type_ck',
    v_name || '_sitemap_type_ck',
    v_name || '_status_ck',
    v_name || '_wp_status_ck'
  );

  EXECUTE ddl;

  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS client_name text NOT NULL DEFAULT %L',
    v_name,
    ''
  );
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS categories text', v_name);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tags text', v_name);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS featured_image_url text', v_name);
  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS menu_order integer NOT NULL DEFAULT 0',
    v_name
  );

  EXECUTE format(
    'UPDATE public.%I SET client_name = %L WHERE client_name IS NULL OR length(btrim(client_name)) = 0',
    v_name,
    trim(both from coalesce(p_display_label, ''))
  );

  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_name);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', v_name);
  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role, postgres',
    v_name
  );
  EXECUTE format(
    'GRANT USAGE, SELECT ON SEQUENCE public.%I TO service_role, postgres',
    v_name || '_id_seq'
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON public.%I (status)',
    v_name || '_status_idx',
    v_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON public.%I (content_type, status)',
    v_name || '_type_status_idx',
    v_name
  );

  RETURN v_name;
END;
$$;

REVOKE ALL ON FUNCTION public.flowbie_ensure_content_bank(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flowbie_ensure_content_bank(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.flowbie_ensure_content_bank(text, text) TO postgres;
