-- Cho phép người dùng đã đăng nhập đánh giá sân trực tiếp, không bắt buộc phải có booking.
alter table reviews alter column booking_id drop not null;

create index if not exists idx_reviews_user_court_updated_at on reviews(user_id, court_id, updated_at desc);
create index if not exists idx_blog_comments_post_created_at on blog_comments(post_id, created_at desc);
