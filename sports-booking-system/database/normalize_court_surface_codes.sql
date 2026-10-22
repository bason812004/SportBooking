-- Normalize legacy numeric/S-prefixed codes without deleting or merging courts.
-- Existing IDs, bookings and closure history are preserved. Re-running is safe.
begin;
lock table courts, court_surfaces in share row exclusive mode;
do $$
declare
  row_data record;
  candidate integer;
  new_code text;
  digits text;
begin
  for row_data in
    select s.id, s.court_id, s.code, c.name as court_name
    from court_surfaces s join courts c on c.id = s.court_id
    where trim(s.code) ~* '^s?[0-9]{1,8}$'
    -- Reserve existing S codes first; numeric aliases get a free code if needed.
    order by s.court_id, (trim(s.code) ~* '^s') desc, s.sort_order, s.id
  loop
    candidate := greatest(regexp_replace(trim(row_data.code), '^[sS]', '')::integer, 1);
    loop
      digits := case when candidate < 10 then '0' || candidate::text else candidate::text end;
      new_code := 'S' || digits;
      exit when not exists (
        select 1 from court_surfaces
        where court_id = row_data.court_id and id <> row_data.id and upper(trim(code)) = new_code
      );
      candidate := candidate + 1;
    end loop;
    update court_surfaces
    set code = new_code,
        name = left(row_data.court_name, 160 - length(' - Sân ' || digits)) || ' - Sân ' || digits
    where id = row_data.id
      and (code is distinct from new_code or name is distinct from
        left(row_data.court_name, 160 - length(' - Sân ' || digits)) || ' - Sân ' || digits);
  end loop;
end $$;
commit;
