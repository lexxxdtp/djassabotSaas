# 📱 Implémentation : Connexion par Téléphone + Vérification

## ✅ Modifications Déjà Effectuées

### 1. Base de données (`database/schema.sql`)
- ✅ Ajout du champ `phone` (format: +225XXXXXXXXXX)
- ✅ Ajout des champs `email_verified` et `phone_verified`
- ✅ email et phone sont maintenant optionnels (mais au moins 1 requis)
- ✅ Index créé sur `phone` pour la performance

### 2. Types TypeScript (`backend/src/types/index.ts`)
- ✅ Interface `User` mise à jour avec `phone`, `emailVerified`, `phoneVerified`

---

## 🔧 Modifications à Faire

### 3. Backend - Authentication Routes (`backend/src/routes/authRoutes.ts`)

**A. Modifier `/signup`**
- Accepter `phone` en option (valider format +225XXXXXXXXXX)
- Si `phone` fourni, envoyer SMS de vérification
- Si `email` fourni, envoyer email de vérification

**B. Modifier `/login`**
- Accepter `identifier` (peut être email OU phone)
- Chercher l'utilisateur par email ou phone
- Permettre connexion même si non vérifié (mais afficher avertissement)

**C. Ajouter `/verify-phone`**
- Endpoint pour vérifier le code SMS
- Mettre à jour `phone_verified = true`

**D. Ajouter `/resend-verification`**
- Renvoyer le code de vérification

### 4. Frontend - Signup & Login

**A. Modifier `/src/pages/Signup.tsx`**
- Ajouter un toggle "Email" / "Téléphone"
- Si Téléphone :
  - Input avec format +225XX XX XX XX XX
  - Validation : exactement 10 chiffres après +225
- Afficher message "Code de vérification envoyé" après signup

**B. Modifier `/src/pages/Login.tsx`**
- Champ "Email ou Téléphone"
- Détecter automatiquement si c'est un email (contient @) ou téléphone (+225)

---

## 📞 Service de Vérification SMS

### Option 1 : Twilio (Recommandé pour production)
```typescript
// backend/src/services/smsService.ts
import twilio from 'twilio';

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

export async function sendVerificationSMS(phone: string, code: string) {
    await client.messages.create({
        body: `Votre code de vérification DJASSABOT : ${code}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
    });
}
```

**Coût** : ~0.05$ par SMS

### Option 2 : Service ivoirien (Pour tests)
- **Orange SMS API** (Côte d'Ivoire)
- **MTN SMS API** (Côte d'Ivoire)

### Option 3 : Mode développement (TEMPORAIRE)
```typescript
// Stocker le code en DB et l'afficher dans la console
console.log(`[DEV] Code de vérification pour ${phone}: ${code}`);
```

---

## 🎯 Prochaines Étapes Recommandées

1. **Phase 1 - Connexion Téléphone (Sans vérification)**
   - Permettre signup/login avec téléphone
   - Pas de vérification obligatoire (juste optionnelle)
   
2. **Phase 2 - Vérification SMS**
   - Intégrer Twilio pour production
   - Mode dev pour tests locaux

3. **Phase 3 - Email Verification**
   - Utiliser Supabase Auth (déjà intégré)

---

## ❓ Décision à Prendre

**Veux-tu qu'on commence par :**
- A) Implémenter connexion par téléphone SANS vérification (plus rapide)
- B) Implémenter directement avec vérification SMS (nécessite compte Twilio)

**Pour l'instant (déploiement rapide)**, je recommande **A** puis ajouter la vérification en Phase 2.
