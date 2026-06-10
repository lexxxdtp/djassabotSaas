-- Interrupteur global du bot : false = le bot lit les messages mais ne répond jamais.
-- Défaut false : un nouveau vendeur doit activer son bot explicitement (sécurité).
alter table settings add column if not exists bot_active boolean not null default false;
