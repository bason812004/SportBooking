alter table partner_profiles
  add column if not exists bank_name varchar(120),
  add column if not exists bank_account_number varchar(60),
  add column if not exists bank_account_holder varchar(160),
  add column if not exists tax_code varchar(60);

