-- Teams: an admin can set someone's team (department) by hand. Then the Microsoft people sync
-- leaves it alone until the admin switches back to Microsoft's value.
ALTER TABLE "people" ADD COLUMN "team_manual" BOOLEAN NOT NULL DEFAULT false;
