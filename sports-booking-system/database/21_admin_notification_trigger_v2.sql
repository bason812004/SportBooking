-- Second version of the admin review notifications (replaces the function created by
-- admin_notification_outbox.sql; the seven admin_review_notification triggers keep calling it).
--   * courts: notify when a court is submitted (INSERT as PENDING) or sent back to PENDING, not on
--     every later write to a court that is already pending. Every partner edit of court details sets
--     approval_status = PENDING, so submissions are not missed; system and admin writes such as the
--     surface count, deposit %, counter time-charge policy or admin note no longer re-notify admins.
--   * partner_profiles: commission_rate is set by admins and no longer counts as a partner update.
--   * Messages name the court, partner or author and carry the reason or amount, so admins can
--     triage from the notification bell.
-- Single statement, schema-qualified; safe to run more than once.
-- Check: npx tsx src/scripts/check_admin_notification_triggers.ts ../database/21_admin_notification_trigger_v2.sql
CREATE OR REPLACE FUNCTION public.enqueue_admin_review_notification() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  n jsonb := to_jsonb(NEW);
  o jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  event_type text;
  event_title text;
  event_content text;
  event_metadata jsonb;
  court_name text;
  partner_name text;
  author_name text;
BEGIN
  IF TG_TABLE_NAME = 'court_image_requests' THEN
    IF TG_OP <> 'INSERT' OR n->>'status' <> 'PENDING' THEN RETURN NEW; END IF;
    SELECT name INTO court_name FROM courts WHERE id = n->>'court_id';
    event_type := 'COURT_IMAGE_SUBMITTED';
    event_title := 'Ảnh sân mới cần duyệt';
    event_content := coalesce(court_name, n->>'court_id')
      || CASE WHEN n->>'replace_image_id' IS NOT NULL THEN ': yêu cầu thay ảnh.' ELSE ': gửi ảnh mới.' END;
    event_metadata := jsonb_build_object('courtId', n->>'court_id', 'imageRequestId', n->>'id');
  ELSIF TG_TABLE_NAME = 'reports' THEN
    IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
    SELECT name INTO court_name FROM courts WHERE id = n->>'court_id';
    event_type := 'REPORT_CREATED';
    event_title := 'Báo cáo sân mới';
    event_content := coalesce(court_name, n->>'court_id') || ' bị báo cáo: '
      || coalesce(nullif(n->>'reason', ''), 'không ghi lý do') || '.';
    event_metadata := jsonb_build_object('reportId', n->>'id', 'courtId', n->>'court_id');
  ELSIF TG_TABLE_NAME = 'withdrawal_requests' THEN
    IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
    SELECT business_name INTO partner_name FROM partner_profiles WHERE id = n->>'partner_id';
    event_type := 'WITHDRAWAL_CREATED';
    event_title := 'Yêu cầu rút tiền mới';
    event_content := coalesce(partner_name, 'Đối tác') || ' yêu cầu rút '
      || replace(to_char((n->>'amount')::numeric, 'FM999,999,999,990'), ',', '.') || 'đ.';
    event_metadata := jsonb_build_object('withdrawalId', n->>'id', 'partnerId', n->>'partner_id', 'amount', n->'amount');
  ELSIF TG_TABLE_NAME = 'courts' THEN
    IF n->>'approval_status' <> 'PENDING' OR (TG_OP = 'UPDATE' AND o->>'approval_status' = 'PENDING') THEN RETURN NEW; END IF;
    SELECT business_name INTO partner_name FROM partner_profiles WHERE id = n->>'partner_id';
    event_type := 'COURT_APPROVAL_REQUESTED';
    event_title := CASE WHEN TG_OP = 'INSERT' THEN 'Sân mới cần duyệt' ELSE 'Sân cần duyệt lại' END;
    event_content := coalesce(partner_name, 'Đối tác')
      || CASE WHEN TG_OP = 'INSERT' THEN ' gửi sân mới: ' ELSE ' cập nhật thông tin sân: ' END
      || coalesce(n->>'name', n->>'id') || '.';
    event_metadata := jsonb_build_object('courtId', n->>'id', 'partnerId', n->>'partner_id');
  ELSIF TG_TABLE_NAME = 'partner_profiles' THEN
    IF n->>'approval_status' <> 'PENDING' OR (TG_OP = 'UPDATE' AND
      (n - ARRAY['updated_at','commission_rate']) = (o - ARRAY['updated_at','commission_rate'])) THEN RETURN NEW; END IF;
    event_type := 'PARTNER_APPROVAL_REQUESTED';
    event_title := CASE WHEN TG_OP = 'INSERT' THEN 'Đối tác mới cần duyệt' ELSE 'Hồ sơ đối tác cần duyệt' END;
    event_content := coalesce(nullif(n->>'business_name', ''), 'Đối tác')
      || CASE WHEN TG_OP = 'INSERT' THEN ' vừa đăng ký làm đối tác.' ELSE ' vừa cập nhật hồ sơ chờ duyệt.' END;
    event_metadata := jsonb_build_object('partnerId', n->>'id');
  ELSIF TG_TABLE_NAME = 'blog_posts' THEN
    IF n->>'status' <> 'PENDING' OR (TG_OP = 'UPDATE' AND
      (n - ARRAY['updated_at','view_count','allow_comments']) =
      (o - ARRAY['updated_at','view_count','allow_comments'])) THEN RETURN NEW; END IF;
    SELECT full_name INTO author_name FROM users WHERE id = n->>'author_id';
    event_type := 'BLOG_UPDATE_REQUESTED';
    event_title := 'Bài viết cần duyệt';
    event_content := coalesce(author_name, 'Người dùng')
      || CASE WHEN TG_OP = 'UPDATE' AND o->>'status' = 'PENDING' THEN ' sửa bài viết đang chờ duyệt: ' ELSE ' gửi bài viết: ' END
      || coalesce(n->>'title', n->>'id');
    event_metadata := jsonb_build_object('blogId', n->>'id', 'authorId', n->>'author_id');
  ELSIF TG_TABLE_NAME = 'tournaments' THEN
    IF n->>'status' <> 'PENDING' OR (TG_OP = 'UPDATE' AND
      (n - ARRAY['updated_at','current_participants']) =
      (o - ARRAY['updated_at','current_participants'])) THEN RETURN NEW; END IF;
    SELECT business_name INTO partner_name FROM partner_profiles WHERE id = n->>'partner_id';
    event_type := 'TOURNAMENT_CREATED';
    event_title := 'Giải đấu cần duyệt';
    event_content := coalesce(partner_name, 'Đối tác') || ' gửi giải đấu: ' || coalesce(n->>'title', n->>'id');
    event_metadata := jsonb_build_object('tournamentId', n->>'id', 'partnerId', n->>'partner_id');
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO admin_notification_outbox(title, content, type, metadata)
  VALUES (event_title, event_content, event_type, event_metadata);
  RETURN NEW;
END;
$$;
