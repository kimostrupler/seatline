-- Runs once when the local Postgres container is first created.
--
-- seatline      = owner / migrations (superuser in local dev)
-- seatline_app  = what the API connects as: NOT the table owner and no BYPASSRLS,
--                 so Row-Level Security always applies to it.
CREATE ROLE seatline_app LOGIN PASSWORD 'seatline_app';

-- Separate database for the automated tests.
CREATE DATABASE seatline_test OWNER seatline;

-- Separate database for the browser (Playwright) tests.
CREATE DATABASE seatline_e2e OWNER seatline;
