-- ============================================================================
-- Sign-in with an e-mail link (workspaces without Microsoft 365).
-- A link carries a random token; only its SHA-256 is stored. Links work once and expire.
-- The table has no tenant (it exists before we know who it is) and the app role gets no
-- access to it: only the SECURITY DEFINER functions below touch it.
-- ============================================================================
CREATE TABLE email_sign_ins (
  token_hash TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ(3) NOT NULL,
  used_at    TIMESTAMPTZ(3)
);
CREATE INDEX email_sign_ins_email_created_at_idx ON email_sign_ins (email, created_at);
ALTER TABLE email_sign_ins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_sign_ins FROM PUBLIC;

-- New link, unless this address already got `max_recent` links in the last 15 minutes.
-- Also clears out links older than a day (nothing personal is kept longer).
CREATE FUNCTION email_sign_in_create(p_email text, p_hash text, p_ttl interval, max_recent int)
  RETURNS boolean
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM email_sign_ins WHERE created_at < now() - interval '1 day';
  IF (SELECT count(*) FROM email_sign_ins
      WHERE email = lower(p_email) AND created_at > now() - interval '15 minutes') >= max_recent THEN
    RETURN false;
  END IF;
  INSERT INTO email_sign_ins (token_hash, email, expires_at)
    VALUES (p_hash, lower(p_email), now() + p_ttl);
  RETURN true;
END $$;

-- Uses a link: returns its e-mail address once, while it is still valid; NULL otherwise.
CREATE FUNCTION email_sign_in_use(p_hash text) RETURNS text
  LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  UPDATE email_sign_ins SET used_at = now()
  WHERE token_hash = p_hash AND used_at IS NULL AND expires_at > now()
  RETURNING email
$$;

-- Every workspace with a person who has this e-mail address (before we know the tenant).
CREATE FUNCTION email_workspaces(p_email text)
  RETURNS TABLE (tenant_id uuid, name text, microsoft boolean)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, t.entra_tenant_id IS NOT NULL
  FROM people p JOIN tenants t ON t.id = p.tenant_id
  WHERE lower(p.email) = lower(p_email) AND p.forgotten_at IS NULL
  ORDER BY t.created_at
$$;

REVOKE ALL ON FUNCTION email_sign_in_create(text, text, interval, int), email_sign_in_use(text),
  email_workspaces(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION email_sign_in_create(text, text, interval, int), email_sign_in_use(text),
  email_workspaces(text) TO seatline_app;
