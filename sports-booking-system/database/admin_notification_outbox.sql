-- Apply after repair_court_image_moderation.sql. Additive; no historic events are replayed.
BEGIN;
CREATE TABLE IF NOT EXISTS admin_notification_outbox (
  id bigserial PRIMARY KEY,
  title varchar(160) NOT NULL,
  content text NOT NULL,
  type varchar(80) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text
);
CREATE INDEX IF NOT EXISTS idx_admin_outbox_pending ON admin_notification_outbox(next_attempt_at, id) WHERE processed_at IS NULL;
ALTER TABLE admin_notification_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION enqueue_admin_review_notification() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  n jsonb := to_jsonb(NEW);
  o jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  event_type text;
  event_title text;
  event_content text;
  event_metadata jsonb;
BEGIN
  IF TG_TABLE_NAME = 'court_image_requests' THEN
    IF TG_OP <> 'INSERT' OR n->>'status' <> 'PENDING' THEN RETURN NEW; END IF;
    event_type := 'COURT_IMAGE_SUBMITTED';
    event_title := 'Ảnh sân mới cần duyệt';
    event_content := 'Đối tác đã gửi ảnh sân mới hoặc yêu cầu thay ảnh đại diện.';
    event_metadata := jsonb_build_object('courtId', n->>'court_id', 'imageRequestId', n->>'id');
  ELSIF TG_TABLE_NAME = 'reports' THEN
    IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
    event_type := 'REPORT_CREATED';
    event_title := 'Báo cáo sân mới';
    event_content := 'Người dùng vừa gửi báo cáo sân cần kiểm tra.';
    event_metadata := jsonb_build_object('reportId', n->>'id', 'courtId', n->>'court_id');
  ELSIF TG_TABLE_NAME = 'withdrawal_requests' THEN
    IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
    event_type := 'WITHDRAWAL_CREATED';
    event_title := 'Yêu cầu rút tiền mới';
    event_content := 'Đối tác vừa gửi yêu cầu rút tiền. Kiểm tra trạng thái xử lý tại trang rút tiền.';
    event_metadata := jsonb_build_object('withdrawalId', n->>'id', 'partnerId', n->>'partner_id');
  ELSIF TG_TABLE_NAME = 'courts' THEN
    IF n->>'approval_status' <> 'PENDING' OR (TG_OP = 'UPDATE' AND
      (n - ARRAY['updated_at','active_status','featured','verified','view_count']) =
      (o - ARRAY['updated_at','active_status','featured','verified','view_count'])) THEN RETURN NEW; END IF;
    event_type := 'COURT_APPROVAL_REQUESTED';
    event_title := 'Sân cần duyệt';
    event_content := 'Đối tác gửi thông tin sân: ' || coalesce(n->>'name', n->>'id');
    event_metadata := jsonb_build_object('courtId', n->>'id');
  ELSIF TG_TABLE_NAME = 'partner_profiles' THEN
    IF n->>'approval_status' <> 'PENDING' OR (TG_OP = 'UPDATE' AND
      (n - ARRAY['updated_at']) = (o - ARRAY['updated_at'])) THEN RETURN NEW; END IF;
    event_type := 'PARTNER_APPROVAL_REQUESTED';
    event_title := 'Hồ sơ đối tác cần duyệt';
    event_content := 'Hồ sơ đối tác mới hoặc vừa cập nhật cần kiểm tra.';
    event_metadata := jsonb_build_object('partnerId', n->>'id');
  ELSIF TG_TABLE_NAME = 'blog_posts' THEN
    IF n->>'status' <> 'PENDING' OR (TG_OP = 'UPDATE' AND
      (n - ARRAY['updated_at','view_count','allow_comments']) =
      (o - ARRAY['updated_at','view_count','allow_comments'])) THEN RETURN NEW; END IF;
    event_type := 'BLOG_UPDATE_REQUESTED';
    event_title := 'Bài viết cần duyệt';
    event_content := 'Bài viết mới hoặc vừa cập nhật: ' || coalesce(n->>'title', n->>'id');
    event_metadata := jsonb_build_object('blogId', n->>'id', 'authorId', n->>'author_id');
  ELSIF TG_TABLE_NAME = 'tournaments' THEN
    IF n->>'status' <> 'PENDING' OR (TG_OP = 'UPDATE' AND
      (n - ARRAY['updated_at','current_participants']) =
      (o - ARRAY['updated_at','current_participants'])) THEN RETURN NEW; END IF;
    event_type := 'TOURNAMENT_CREATED';
    event_title := 'Giải đấu cần duyệt';
    event_content := 'Giải đấu mới hoặc vừa cập nhật: ' || coalesce(n->>'title', n->>'id');
    event_metadata := jsonb_build_object('tournamentId', n->>'id');
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO admin_notification_outbox(title, content, type, metadata)
  VALUES (event_title, event_content, event_type, event_metadata);
  RETURN NEW;
END;
$$;

-- One trigger per table. Reapplying the migration never duplicates triggers/events.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['courts','partner_profiles','blog_posts','reports','court_image_requests','withdrawal_requests','tournaments'] LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      RAISE EXCEPTION 'Missing prerequisite table: %', table_name;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS admin_review_notification ON %I', table_name);
    EXECUTE format('CREATE TRIGGER admin_review_notification AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION enqueue_admin_review_notification()', table_name);
  END LOOP;
END;
$$;
COMMIT;
