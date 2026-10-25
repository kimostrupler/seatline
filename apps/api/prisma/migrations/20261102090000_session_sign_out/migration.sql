-- ============================================================================
-- Sign-out ends a session everywhere it was copied to. A session cookie carries a random id
-- (sid); signing out records it here until the cookie would have expired anyway, and the API
-- refuses tokens with a recorded sid. Only that one device is signed out — other sign-ins of
-- the same person stay. No tenant (a sid alone says nothing about anyone), reachable only
-- through the two SECURITY DEFINER functions below.
-- ============================================================================
CREATE TABLE signed_out_sessions (
  sid        TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ(3) NOT NULL
);
ALTER TABLE signed_out_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON signed_out_sessions FROM PUBLIC;

-- Records a signed-out session (and forgets ones whose cookie has expired anyway).
CREATE FUNCTION session_sign_out(p_sid text, p_expires timestamptz) RETURNS void
  LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM signed_out_sessions WHERE expires_at < now();
  INSERT INTO signed_out_sessions (sid, expires_at) VALUES (p_sid, p_expires)
    ON CONFLICT (sid) DO NOTHING;
$$;

CREATE FUNCTION session_signed_out(p_sid text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM signed_out_sessions WHERE sid = p_sid)
$$;

REVOKE ALL ON FUNCTION session_sign_out(text, timestamptz), session_signed_out(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION session_sign_out(text, timestamptz), session_signed_out(text)
  TO seatline_app;
