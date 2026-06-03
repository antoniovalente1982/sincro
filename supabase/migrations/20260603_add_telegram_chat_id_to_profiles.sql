-- Aggiunge il campo telegram_chat_id alla tabella profiles
-- Permette ai venditori di ricevere notifiche Telegram personali quando gli viene assegnato un lead

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.profiles.telegram_chat_id IS 'Chat ID Telegram personale del membro del team. Usato per inviare notifiche dirette quando un lead viene assegnato.';
