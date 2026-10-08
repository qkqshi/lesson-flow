CREATE TABLE IF NOT EXISTS app_user (
  telegram_id BIGINT PRIMARY KEY,
  first_name TEXT,
  username TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/Samara',
  notification_time TIME NOT NULL DEFAULT '08:00',
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS google_connection (
  telegram_id BIGINT PRIMARY KEY REFERENCES app_user(telegram_id) ON DELETE CASCADE,
  encrypted_refresh_token TEXT NOT NULL,
  scopes TEXT NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_delivery (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL REFERENCES app_user(telegram_id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'failed')),
  event_count INTEGER,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (telegram_id, schedule_date)
);

CREATE INDEX IF NOT EXISTS notification_delivery_status_idx
  ON notification_delivery (status, schedule_date);

CREATE TABLE IF NOT EXISTS student_profile (
  telegram_id BIGINT NOT NULL REFERENCES app_user(telegram_id) ON DELETE CASCADE,
  normalized_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  lesson_price_kopecks BIGINT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (telegram_id, normalized_name),
  CHECK (lesson_price_kopecks IS NULL OR lesson_price_kopecks >= 0)
);

ALTER TABLE student_profile
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS student_profile_telegram_name_idx
  ON student_profile (telegram_id, display_name);

CREATE TABLE IF NOT EXISTS student_month_plan (
  telegram_id BIGINT NOT NULL,
  normalized_name TEXT NOT NULL,
  plan_month DATE NOT NULL,
  planned_lesson_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (telegram_id, normalized_name, plan_month),
  FOREIGN KEY (telegram_id, normalized_name)
    REFERENCES student_profile (telegram_id, normalized_name)
    ON DELETE CASCADE,
  CHECK (planned_lesson_count >= 0 AND planned_lesson_count <= 1000)
);
