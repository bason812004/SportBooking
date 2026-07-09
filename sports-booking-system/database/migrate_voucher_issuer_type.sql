begin;

alter table vouchers
  alter column partner_id drop not null;

alter table vouchers
  add column if not exists issuer_type varchar(20) not null default 'PARTNER';

alter table vouchers
  drop constraint if exists vouchers_issuer_type_check;
alter table vouchers
  add constraint vouchers_issuer_type_check
  check (issuer_type in ('ADMIN', 'PARTNER'));

alter table vouchers
  drop constraint if exists vouchers_issuer_partner_check;
alter table vouchers
  add constraint vouchers_issuer_partner_check
  check (
    (issuer_type = 'ADMIN' and partner_id is null)
    or (issuer_type = 'PARTNER' and partner_id is not null)
  );

create index if not exists idx_vouchers_issuer_type on vouchers(issuer_type);

commit;
