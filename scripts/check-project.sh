#!/bin/bash

# 🔍 Script de Vérification Automatique - DjassaBot SaaS
# Usage: ./scripts/check-project.sh

echo "🔍 =============================================="
echo "   CHECKING COMPLET DU PROJET"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# ---------------------------------------------
# 1. BACKEND CHECKS
# ---------------------------------------------
echo "📦 [1/5] Vérification Backend..."
cd backend

# Install dependencies
echo "  → Installation des dépendances..."
npm install --silent > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✅ npm install: SUCCÈS${NC}"
else
    echo -e "  ${RED}❌ npm install: ÉCHEC${NC}"
    ((ERRORS++))
fi

# TypeScript compilation
echo "  → Compilation TypeScript..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✅ npm run build: SUCCÈS${NC}"
else
    echo -e "  ${RED}❌ npm run build: ÉCHEC${NC}"
    ((ERRORS++))
fi

# Lint check
echo "  → Vérification lint (tsc --noEmit)..."
npm run lint > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✅ npm run lint: SUCCÈS${NC}"
else
    echo -e "  ${RED}❌ npm run lint: ÉCHEC${NC}"
    ((ERRORS++))
fi

# Security audit
echo "  → Audit de sécurité..."
AUDIT_OUTPUT=$(npm audit --production 2>&1)
CRITICAL=$(echo "$AUDIT_OUTPUT" | grep -o "[0-9]* critical" | awk '{print $1}')
HIGH=$(echo "$AUDIT_OUTPUT" | grep -o "[0-9]* high" | awk '{print $1}')

if [ -z "$CRITICAL" ]; then CRITICAL=0; fi
if [ -z "$HIGH" ]; then HIGH=0; fi

if [ "$CRITICAL" -eq 0 ] && [ "$HIGH" -eq 0 ]; then
    echo -e "  ${GREEN}✅ Audit de sécurité: AUCUNE VULNÉRABILITÉ CRITIQUE${NC}"
else
    echo -e "  ${YELLOW}⚠️  Audit: $CRITICAL critique(s), $HIGH haute(s)${NC}"
fi

cd ..
echo ""

# ---------------------------------------------
# 2. FRONTEND CHECKS
# ---------------------------------------------
echo "🎨 [2/5] Vérification Frontend..."
cd frontend

# Install dependencies
echo "  → Installation des dépendances..."
npm install --silent > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✅ npm install: SUCCÈS${NC}"
else
    echo -e "  ${RED}❌ npm install: ÉCHEC${NC}"
    ((ERRORS++))
fi

# Build
echo "  → Build production..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✅ npm run build: SUCCÈS${NC}"
else
    echo -e "  ${RED}❌ npm run build: ÉCHEC${NC}"
    ((ERRORS++))
fi

# Security audit
echo "  → Audit de sécurité..."
AUDIT_OUTPUT=$(npm audit 2>&1)
CRITICAL=$(echo "$AUDIT_OUTPUT" | grep -o "[0-9]* critical" | awk '{print $1}')
HIGH=$(echo "$AUDIT_OUTPUT" | grep -o "[0-9]* high" | awk '{print $1}')

if [ -z "$CRITICAL" ]; then CRITICAL=0; fi
if [ -z "$HIGH" ]; then HIGH=0; fi

if [ "$CRITICAL" -eq 0 ] && [ "$HIGH" -eq 0 ]; then
    echo -e "  ${GREEN}✅ Audit de sécurité: AUCUNE VULNÉRABILITÉ CRITIQUE${NC}"
else
    echo -e "  ${YELLOW}⚠️  Audit: $CRITICAL critique(s), $HIGH haute(s)${NC}"
    echo -e "  ${YELLOW}   → Exécutez 'npm audit fix' pour corriger${NC}"
fi

cd ..
echo ""

# ---------------------------------------------
# 3. ENV CONFIGURATION CHECK
# ---------------------------------------------
echo "⚙️  [3/5] Vérification de la Configuration..."

# Check .env.example exists
if [ -f "backend/.env.example" ]; then
    echo -e "  ${GREEN}✅ .env.example existe${NC}"
else
    echo -e "  ${YELLOW}⚠️  .env.example manquant${NC}"
fi

# Check .env exists
if [ -f "backend/.env" ]; then
    echo -e "  ${GREEN}✅ .env existe${NC}"
    
    # Check critical env vars
    source backend/.env 2>/dev/null
    
    if [ -n "$GEMINI_API_KEY" ]; then
        echo -e "  ${GREEN}✅ GEMINI_API_KEY défini${NC}"
    else
        echo -e "  ${RED}❌ GEMINI_API_KEY manquant${NC}"
        ((ERRORS++))
    fi
    
    if [ -n "$SUPABASE_URL" ]; then
        echo -e "  ${GREEN}✅ SUPABASE_URL défini${NC}"
    else
        echo -e "  ${RED}❌ SUPABASE_URL manquant${NC}"
        ((ERRORS++))
    fi
    
    if [ -n "$SUPABASE_KEY" ]; then
        echo -e "  ${GREEN}✅ SUPABASE_KEY défini${NC}"
    else
        echo -e "  ${RED}❌ SUPABASE_KEY manquant${NC}"
        ((ERRORS++))
    fi
else
    echo -e "  ${YELLOW}⚠️  .env non trouvé (créez-le depuis .env.example)${NC}"
fi

echo ""

# ---------------------------------------------
# 4. CODE QUALITY CHECKS
# ---------------------------------------------
echo "🔎 [4/5] Analyse de la Qualité du Code..."

# Check for TODOs
TODO_COUNT=$(grep -r "TODO" backend/src frontend/src 2>/dev/null | wc -l | xargs)
echo -e "  📝 TODOs trouvés: $TODO_COUNT"

# Check for console.log in production code
CONSOLE_COUNT=$(grep -r "console\.log" backend/src 2>/dev/null | grep -v "logger" | wc -l | xargs)
if [ "$CONSOLE_COUNT" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠️  console.log trouvés: $CONSOLE_COUNT (recommandé: utiliser logger)${NC}"
else
    echo -e "  ${GREEN}✅ Pas de console.log dans le backend${NC}"
fi

echo ""

# ---------------------------------------------
# 5. FILE STRUCTURE CHECK
# ---------------------------------------------
echo "📂 [5/5] Vérification de la Structure..."

REQUIRED_DIRS=(
    "backend/src/config"
    "backend/src/services"
    "backend/src/routes"
    "backend/src/middleware"
    "backend/src/types"
    "frontend/src/pages"
    "frontend/src/components"
    "frontend/src/utils"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "  ${GREEN}✅ $dir${NC}"
    else
        echo -e "  ${RED}❌ $dir manquant${NC}"
        ((ERRORS++))
    fi
done

echo ""

# ---------------------------------------------
# FINAL REPORT
# ---------------------------------------------
echo "=============================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ CHECKING COMPLET: SUCCÈS${NC}"
    echo "   Aucune erreur critique détectée."
else
    echo -e "${RED}❌ CHECKING COMPLET: $ERRORS ERREUR(S)${NC}"
    echo "   Veuillez corriger les erreurs ci-dessus."
fi
echo "=============================================="
echo ""

exit $ERRORS
