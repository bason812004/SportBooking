-- Staff counter (2026-10-29). Safe to run more than once.

-- Who paused a sub-court: 'PARTNER' or 'RECIPIENT' (court staff). Staff may reopen only a sub-court staff paused;
-- one the partner paused stays closed until the partner reopens it. Null while the sub-court is active.
alter table court_surfaces add column if not exists paused_by_role varchar(20);

-- Sub-courts paused before this column existed cannot be told apart, so they count as paused by the partner.
update court_surfaces set paused_by_role = 'PARTNER' where status = 'INACTIVE' and paused_by_role is null;
