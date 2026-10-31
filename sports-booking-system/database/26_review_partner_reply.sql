-- The court owner's public reply to a review: one reply per review, which the partner can rewrite or remove and an
-- admin can take down (moderation_history action REPLY_REMOVED). A table of its own rather than columns on reviews:
-- the reviews updated_at trigger would otherwise date every reply as the customer's own last edit.
-- author_id keeps which partner account wrote it. Deleting a review deletes its reply.
-- Additive only; safe to run more than once. Run `npx prisma generate` in backend afterwards.
CREATE TABLE IF NOT EXISTS review_replies (
  review_id varchar(20) PRIMARY KEY REFERENCES reviews(id) ON DELETE CASCADE,
  author_id varchar(20),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);
