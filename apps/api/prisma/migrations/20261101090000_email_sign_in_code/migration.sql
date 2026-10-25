-- ============================================================================
-- Sign-in by e-mail: besides the link, the e-mail carries a 6-digit code that can be typed in
-- (an iPhone home-screen app keeps its own sign-in, but links in e-mails always open Safari).
-- Only the code's hash is stored, it shares the link's row (one use, 15 minutes), and a row
-- stops accepting codes after 5 wrong tries, so a code can't be guessed.
-- ============================================================================
ALTER TABLE email_sign_ins
  ADD COLUMN code_hash TEXT,
  ADD COLUMN failed_codes INT NOT NULL DEFAULT 0;

-- A 5-argument version that also stores the code's hash. The old 4-argument one stays (links
-- without a code) for the minute of a deploy in which the previous API version still runs.
CREATE FUNCTION email_sign_in_create(
  p_email text, p_hash text, p_code_hash text, p_ttl interval, max_recent int
) RETURNS boolean
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM email_sign_ins WHERE created_at < now() - interval '1 day';
  IF (SELECT count(*) FROM email_sign_ins
      WHERE email = lower(p_email) AND created_at > now() - interval '15 minutes') >= max_recent THEN
    RETURN false;
  END IF;
  INSERT INTO email_sign_ins (token_hash, email, code_hash, expires_at)
    VALUES (p_hash, lower(p_email), p_code_hash, now() + p_ttl);
  RETURN true;
END $$;

-- Uses a code: the address once, while one of its links is valid and has had fewer than
-- `max_failed` wrong codes; NULL otherwise. A wrong code counts against every open link of
-- the address (so asking for more e-mails doesn't buy more guesses).
CREATE FUNCTION email_sign_in_use_code(p_email text, p_code_hash text, max_failed int)
  RETURNS text
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  found text;
BEGIN
  UPDATE email_sign_ins SET used_at = now()
  WHERE token_hash = (
    SELECT token_hash FROM email_sign_ins
    WHERE email = lower(p_email) AND code_hash = p_code_hash AND used_at IS NULL
      AND expires_at > now() AND failed_codes < max_failed
    ORDER BY created_at DESC LIMIT 1
    FOR UPDATE
  )
  RETURNING email INTO found;
  IF found IS NULL THEN
    UPDATE email_sign_ins SET failed_codes = failed_codes + 1
    WHERE email = lower(p_email) AND used_at IS NULL AND expires_at > now();
  END IF;
  RETURN found;
END $$;

REVOKE ALL ON FUNCTION email_sign_in_create(text, text, text, interval, int),
  email_sign_in_use_code(text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION email_sign_in_create(text, text, text, interval, int),
  email_sign_in_use_code(text, text, int) TO seatline_app;
