-- Enable Realtime on leads and notifications tables
-- Required for Supabase Realtime subscriptions (postgres_changes)
-- This adds the tables to the realtime publication so they broadcast changes via WebSocket
--
-- Applicata il 2026-06-04:
--   leads: era già in supabase_realtime publication ✓
--   notifications: aggiunta ora ✓

-- leads già presente, non serve ADD
-- ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
