#!/usr/bin/env bash
# ============================================================
# Backup des sessions WhatsApp (auth Baileys)
# ============================================================
# Si le disque du VPS meurt, TOUS les vendeurs doivent rescanner
# leur QR. Ce script archive les credentials chaque nuit.
#
# Installation sur le VPS (une seule fois) :
#   chmod +x /home/alex/djassabotSaas/scripts/backup_wa_auth.sh
#   crontab -e
#   # puis ajouter cette ligne (backup chaque nuit à 3h) :
#   0 3 * * * /home/alex/djassabotSaas/scripts/backup_wa_auth.sh >> /home/alex/backups/wa_auth.log 2>&1
#
# Les 7 derniers backups sont conservés.
# Pour restaurer : tar xzf wa_auth_YYYY-MM-DD.tar.gz -C /home/alex/djassabotSaas/backend/
# ============================================================
set -euo pipefail

AUTH_DIR="/home/alex/djassabotSaas/backend/auth_info_baileys"
BACKUP_DIR="/home/alex/backups"
STAMP=$(date +%F_%H%M)

mkdir -p "$BACKUP_DIR"

if [ ! -d "$AUTH_DIR" ]; then
    echo "[$(date)] Rien à sauvegarder ($AUTH_DIR absent)"
    exit 0
fi

tar czf "$BACKUP_DIR/wa_auth_${STAMP}.tar.gz" -C "$(dirname "$AUTH_DIR")" "$(basename "$AUTH_DIR")"
echo "[$(date)] Backup créé : wa_auth_${STAMP}.tar.gz ($(du -h "$BACKUP_DIR/wa_auth_${STAMP}.tar.gz" | cut -f1))"

# Rotation : garder les 7 plus récents
ls -1t "$BACKUP_DIR"/wa_auth_*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
echo "[$(date)] Rotation OK ($(ls -1 "$BACKUP_DIR"/wa_auth_*.tar.gz | wc -l) backups conservés)"
