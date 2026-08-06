-- Resync seq_courts after migrate_add_20_more_courts.sql inserted courts c0021-c0040
-- with explicit ids but never called setval, leaving the sequence behind the real max id.
select setval('seq_courts', (select max(substring(id from 2)::int) from courts));
