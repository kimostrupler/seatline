-- Desk size per floor (metres; null = 1.6 × 0.8) and how desks are numbered.
ALTER TABLE "floors"
  ADD COLUMN "desk_width" DOUBLE PRECISION,
  ADD COLUMN "desk_depth" DOUBLE PRECISION,
  ADD COLUMN "seat_numbering" TEXT NOT NULL DEFAULT 'floor',
  ADD CONSTRAINT "floors_desk_width_check" CHECK ("desk_width" IS NULL OR "desk_width" BETWEEN 0.3 AND 5),
  ADD CONSTRAINT "floors_desk_depth_check" CHECK ("desk_depth" IS NULL OR "desk_depth" BETWEEN 0.3 AND 5),
  ADD CONSTRAINT "floors_seat_numbering_check" CHECK ("seat_numbering" IN ('floor', 'room'));
