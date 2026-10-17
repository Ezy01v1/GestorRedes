-- CreateEnum
CREATE TYPE "Network" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('IG_BUSINESS', 'IG_CREATOR', 'FB_PAGE', 'LI_MEMBER', 'LI_ORGANIZATION', 'WA_PHONE_NUMBER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'NEEDS_RECONNECT', 'DISABLED');

-- CreateEnum
CREATE TYPE "PostFormat" AS ENUM ('FEED', 'CAROUSEL', 'REEL', 'STORY', 'TEXT', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "TargetStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'MISSED', 'NEEDS_REVIEW', 'CANCELED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "SnapshotSource" AS ENUM ('CRON', 'MANUAL', 'BACKFILL');

-- CreateEnum
CREATE TYPE "ThreadKind" AS ENUM ('COMMENT', 'DIRECT');

-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('OPEN', 'DONE');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('POST_PUBLISHED', 'POST_FAILED', 'POST_MISSED', 'POST_NEEDS_REVIEW', 'TOKEN_EXPIRING', 'ACCOUNT_NEEDS_RECONNECT', 'NEW_COMMENT', 'NEW_MESSAGE', 'SYNC_FAILED', 'RATE_LIMITED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_states" (
    "state" TEXT NOT NULL,
    "network" "Network" NOT NULL,
    "code_verifier" TEXT,
    "redirect_to" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("state")
);

-- CreateTable
CREATE TABLE "connected_accounts" (
    "id" TEXT NOT NULL,
    "network" "Network" NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "external_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "username" TEXT,
    "avatar_url" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "scopes" TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "connected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_credentials" (
    "account_id" TEXT NOT NULL,
    "access_token_enc" BYTEA NOT NULL,
    "refresh_token_enc" BYTEA,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMPTZ(3),
    "refresh_expires_at" TIMESTAMPTZ(3),
    "last_refreshed_at" TIMESTAMPTZ(3),
    "last_refresh_error" TEXT,

    CONSTRAINT "oauth_credentials_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "sync_states" (
    "account_id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "cursor" TEXT,
    "last_run_at" TIMESTAMPTZ(3),
    "last_success_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "backoff_until" TIMESTAMPTZ(3),

    CONSTRAINT "sync_states_pkey" PRIMARY KEY ("account_id","resource")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "thumbnail_path" TEXT,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_ms" INTEGER,
    "alt_text" TEXT,
    "tags" TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "base_text" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_targets" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "format" "PostFormat" NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "first_comment" TEXT,
    "options" JSONB NOT NULL DEFAULT '{}',
    "status" "TargetStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMPTZ(3),
    "publish_started_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "provider_container_id" TEXT,
    "external_id" TEXT,
    "external_url" TEXT,
    "last_error" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "post_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_target_media" (
    "target_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "post_target_media_pkey" PRIMARY KEY ("target_id","position")
);

-- CreateTable
CREATE TABLE "publish_attempts" (
    "id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "outcome" TEXT,
    "http_status" INTEGER,
    "error" JSONB,

    CONSTRAINT "publish_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hashtag_sets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tags" TEXT[],
    "networks" "Network"[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hashtag_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "post_target_id" TEXT,
    "format" "PostFormat" NOT NULL,
    "caption" TEXT,
    "permalink" TEXT,
    "thumbnail_url" TEXT,
    "published_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "latest_metrics" JSONB NOT NULL DEFAULT '{}',
    "metrics_updated_at" TIMESTAMPTZ(3),

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "account_id" TEXT NOT NULL,
    "network" "Network" NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "captured_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "SnapshotSource" NOT NULL,
    "metrics" JSONB NOT NULL,
    "raw" JSONB,
    "catalog_version" INTEGER NOT NULL,
    "api_version" TEXT NOT NULL,

    CONSTRAINT "account_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_metric_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "social_post_id" TEXT NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "captured_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metrics" JSONB NOT NULL,
    "catalog_version" INTEGER NOT NULL,

    CONSTRAINT "post_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_threads" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "kind" "ThreadKind" NOT NULL,
    "external_id" TEXT NOT NULL,
    "social_post_id" TEXT,
    "participant_name" TEXT,
    "participant_handle" TEXT,
    "participant_external_id" TEXT,
    "status" "ThreadStatus" NOT NULL DEFAULT 'OPEN',
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMPTZ(3) NOT NULL,
    "reply_window_ends_at" TIMESTAMPTZ(3),

    CONSTRAINT "inbox_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "author_name" TEXT,
    "author_external_id" TEXT,
    "text" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMPTZ(3) NOT NULL,
    "read_at" TIMESTAMPTZ(3),

    CONSTRAINT "inbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "refs" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "app_secrets" (
    "key" TEXT NOT NULL,
    "value_enc" BYTEA NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_secrets_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_singleton_key" ON "users"("singleton");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "connected_accounts_network_external_id_key" ON "connected_accounts"("network", "external_id");

-- CreateIndex
CREATE INDEX "oauth_credentials_expires_at_idx" ON "oauth_credentials"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_path_key" ON "media_assets"("storage_path");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_sha256_key" ON "media_assets"("sha256");

-- CreateIndex
CREATE INDEX "media_assets_created_at_idx" ON "media_assets"("created_at" DESC);

-- CreateIndex
CREATE INDEX "post_targets_account_id_scheduled_at_idx" ON "post_targets"("account_id", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "post_targets_post_id_account_id_format_key" ON "post_targets"("post_id", "account_id", "format");

-- CreateIndex
CREATE INDEX "post_target_media_media_id_idx" ON "post_target_media"("media_id");

-- CreateIndex
CREATE INDEX "publish_attempts_target_id_started_at_idx" ON "publish_attempts"("target_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "hashtag_sets_name_key" ON "hashtag_sets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "social_posts_post_target_id_key" ON "social_posts"("post_target_id");

-- CreateIndex
CREATE INDEX "social_posts_account_id_published_at_idx" ON "social_posts"("account_id", "published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "social_posts_account_id_external_id_key" ON "social_posts"("account_id", "external_id");

-- CreateIndex
CREATE INDEX "account_snapshots_network_snapshot_date_idx" ON "account_snapshots"("network", "snapshot_date");

-- CreateIndex
CREATE INDEX "account_snapshots_snapshot_date_idx" ON "account_snapshots"("snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "account_snapshots_account_id_snapshot_date_key" ON "account_snapshots"("account_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "post_metric_snapshots_snapshot_date_idx" ON "post_metric_snapshots"("snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "post_metric_snapshots_social_post_id_snapshot_date_key" ON "post_metric_snapshots"("social_post_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "inbox_threads_status_last_message_at_idx" ON "inbox_threads"("status", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "inbox_threads_account_id_last_message_at_idx" ON "inbox_threads"("account_id", "last_message_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "inbox_threads_account_id_kind_external_id_key" ON "inbox_threads"("account_id", "kind", "external_id");

-- CreateIndex
CREATE INDEX "inbox_messages_thread_id_sent_at_idx" ON "inbox_messages"("thread_id", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_messages_thread_id_external_id_key" ON "inbox_messages"("thread_id", "external_id");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_credentials" ADD CONSTRAINT "oauth_credentials_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_states" ADD CONSTRAINT "sync_states_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_targets" ADD CONSTRAINT "post_targets_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_targets" ADD CONSTRAINT "post_targets_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "connected_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_target_media" ADD CONSTRAINT "post_target_media_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "post_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_target_media" ADD CONSTRAINT "post_target_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_attempts" ADD CONSTRAINT "publish_attempts_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "post_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_post_target_id_fkey" FOREIGN KEY ("post_target_id") REFERENCES "post_targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_metric_snapshots" ADD CONSTRAINT "post_metric_snapshots_social_post_id_fkey" FOREIGN KEY ("social_post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_threads" ADD CONSTRAINT "inbox_threads_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_threads" ADD CONSTRAINT "inbox_threads_social_post_id_fkey" FOREIGN KEY ("social_post_id") REFERENCES "social_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "inbox_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── SQL adicional (docs/design/03-modelo-datos.md §3) ──
-- Un solo usuario por instalación
ALTER TABLE users ADD CONSTRAINT users_singleton CHECK (singleton);

-- Integridad de la programación
ALTER TABLE post_targets ADD CONSTRAINT scheduled_needs_date
  CHECK (status NOT IN ('SCHEDULED','PUBLISHING') OR scheduled_at IS NOT NULL);

-- Las métricas siempre son un objeto JSON
ALTER TABLE account_snapshots    ADD CONSTRAINT metrics_is_object CHECK (jsonb_typeof(metrics) = 'object');
ALTER TABLE post_metric_snapshots ADD CONSTRAINT metrics_is_object CHECK (jsonb_typeof(metrics) = 'object');

-- Índice parcial para el cron "publish-due" (cada minuto): solo filas programadas
CREATE INDEX post_targets_due_idx ON post_targets (scheduled_at) WHERE status = 'SCHEDULED';

-- Contador de notificaciones no leídas
CREATE INDEX notifications_unread_idx ON notifications (created_at DESC) WHERE read_at IS NULL;

-- ── Vista de estadísticas diarias (docs/design/03-modelo-datos.md §5) ──
CREATE VIEW account_daily_stats AS
SELECT
  s.account_id,
  s.network,
  s.snapshot_date,
  (s.metrics->>'followers_count')::int    AS followers,
  (s.metrics->>'following_count')::int    AS following,
  (s.metrics->>'media_count')::int        AS media_count,
  (s.metrics->>'follows')::int            AS follows,
  (s.metrics->>'unfollows')::int          AS unfollows,
  (s.metrics->>'reach')::int              AS reach,
  (s.metrics->>'views')::int              AS views,
  (s.metrics->>'profile_views')::int      AS profile_views,
  (s.metrics->>'total_interactions')::int AS interactions,
  (s.metrics->>'followers_count')::int
    - LAG((s.metrics->>'followers_count')::int) OVER w AS net_followers,
  s.snapshot_date - LAG(s.snapshot_date) OVER w       AS days_since_prev, -- >1 = hubo un hueco
  s.catalog_version
FROM account_snapshots s
WINDOW w AS (PARTITION BY s.account_id ORDER BY s.snapshot_date);
