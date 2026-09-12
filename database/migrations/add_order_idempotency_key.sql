-- Clé d'idempotence de commande
--
-- Problème : un même panier pouvait produire deux commandes. Le client renvoie
-- son adresse (message en double sur WhatsApp, réseau qui coupe, panier resté
-- ouvert parce que sa fermeture a échoué), et le bot revalide : deuxième
-- commande, deuxième décrément de stock, client facturé deux fois.
--
-- La clé identifie le PANIER, pas son contenu : elle est générée au premier
-- article ajouté et vit dans la session. Deux validations du même panier
-- portent la même clé ; une nouvelle commande du même article plus tard en a
-- une différente et reste donc autorisée.
--
-- L'index unique est partiel : les commandes anciennes (clé NULL) et celles
-- créées à la main depuis le dashboard ne sont pas concernées. Il est scopé par
-- boutique : deux vendeurs ne peuvent pas se bloquer mutuellement.
--
-- Le code fonctionne SANS cette migration : il détecte la colonne absente,
-- journalise un avertissement et crée la commande comme avant. Appliquer cette
-- migration active la protection ; ne pas l'appliquer laisse le trou ouvert.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tenant_idempotency
    ON orders (tenant_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
