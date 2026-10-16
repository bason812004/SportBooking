-- ============================================================
-- Purchase orders per court (cụm sân) + receiving audit trail
--
-- Every purchase order belongs to exactly one court, so each address
-- restocks and is audited on its own. The order also records who created,
-- approved (ordered), received or cancelled it, and how many units of each
-- line actually arrived (stock is increased by the received quantity).
--
-- Chạy: cd backend
--   npx prisma db execute --schema prisma/schema.prisma --file ../database/migrate_purchase_order_court_scope.sql
--   npx prisma generate   (rồi khởi động lại backend)
-- Idempotent: chỉ ADD COLUMN / INDEX / CONSTRAINT IF NOT EXISTS, không sửa dữ liệu cũ.
-- ============================================================

alter table purchase_orders add column if not exists court_id varchar(20) references courts(id) on delete no action on update no action;
alter table purchase_orders add column if not exists created_by varchar(20) references users(id) on delete set null on update no action;
alter table purchase_orders add column if not exists ordered_by varchar(20) references users(id) on delete set null on update no action;
alter table purchase_orders add column if not exists received_by varchar(20) references users(id) on delete set null on update no action;
alter table purchase_orders add column if not exists cancelled_by varchar(20) references users(id) on delete set null on update no action;
alter table purchase_orders add column if not exists ordered_at timestamptz;
alter table purchase_orders add column if not exists received_at timestamptz;
alter table purchase_orders add column if not exists cancelled_at timestamptz;
alter table purchase_orders add column if not exists received_amount numeric(12, 2);
alter table purchase_orders add column if not exists receive_note text;

create index if not exists idx_purchase_orders_partner_court_status on purchase_orders (partner_id, court_id, status);

-- Null until the order is received; then the counted quantity (may be below the ordered quantity).
alter table purchase_order_items add column if not exists received_quantity integer;

do $$
begin
  alter table purchase_order_items
    add constraint purchase_order_items_received_quantity_check check (received_quantity is null or received_quantity >= 0);
exception
  when duplicate_object then null;
end $$;
