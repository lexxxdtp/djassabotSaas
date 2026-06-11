import { Link } from 'react-router-dom';
import { ArrowLeft, Bot } from 'lucide-react';

/**
 * Pages légales — Conditions d'utilisation et Politique de confidentialité.
 * Un seul fichier, deux exports, même layout.
 *
 * ⚠️ Ces textes sont une base sérieuse mais ne remplacent pas l'avis
 * d'un avocat ivoirien pour une revue finale avant la croissance.
 */

const LegalLayout = ({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) => (
    <div className="min-h-screen bg-black text-white">
        <header className="border-b border-[#1a1a1a] px-6 py-4">
            <div className="max-w-3xl mx-auto flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-[#00D97E] flex items-center justify-center">
                        <Bot className="w-4 h-4 text-black" />
                    </div>
                    <span className="font-bold">DjassaBot</span>
                </Link>
                <Link to="/" className="flex items-center gap-1.5 text-sm text-[#888] hover:text-white transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Retour
                </Link>
            </div>
        </header>
        <main className="max-w-3xl mx-auto px-6 py-12">
            <h1 className="text-3xl font-bold tracking-tight mb-2">{title}</h1>
            <p className="text-[#555] text-sm mb-10">Dernière mise à jour : {updated}</p>
            <div className="space-y-8 text-[#aaa] text-[15px] leading-relaxed [&_h2]:text-white [&_h2]:font-bold [&_h2]:text-lg [&_h2]:mb-2 [&_strong]:text-white">
                {children}
            </div>
        </main>
        <footer className="border-t border-[#1a1a1a] py-8 text-center text-[#444] text-xs">
            © 2026 DjassaBot — Abidjan, Côte d'Ivoire
        </footer>
    </div>
);

export const Terms = () => (
    <LegalLayout title="Conditions d'utilisation" updated="11 juin 2026">
        <section>
            <h2>1. Le service</h2>
            <p>
                DjassaBot est un service d'assistant de vente automatisé pour WhatsApp, destiné aux
                commerçants. L'assistant répond aux clients du commerçant, présente ses produits,
                prend des commandes et aide à la validation des paiements, sur la base des
                informations que le commerçant renseigne dans son tableau de bord.
            </p>
        </section>
        <section>
            <h2>2. Votre compte</h2>
            <p>
                Vous êtes responsable de l'exactitude des informations de votre boutique (prix,
                stocks, adresse, conditions de livraison) et de la confidentialité de votre mot de
                passe. Un compte correspond à un commerce ; vos données sont isolées de celles des
                autres commerçants.
            </p>
        </section>
        <section>
            <h2>3. Connexion WhatsApp</h2>
            <p>
                DjassaBot se connecte à votre numéro WhatsApp via le protocole WhatsApp Web, comme
                lorsque vous utilisez WhatsApp sur un ordinateur. <strong>WhatsApp n'autorise pas
                officiellement l'automatisation</strong> : en cas d'usage abusif (messages de masse
                non sollicités, spam), votre numéro peut être suspendu par WhatsApp. DjassaBot
                intègre des protections (délais entre messages, envois limités aux clients qui vous
                ont déjà écrit), mais <strong>vous utilisez la connexion WhatsApp sous votre propre
                responsabilité</strong>. Nous vous recommandons de ne jamais envoyer de campagnes à
                des personnes qui ne vous ont pas contacté d'abord.
            </p>
        </section>
        <section>
            <h2>4. Abonnement et paiement</h2>
            <p>
                Le service est facturé par abonnement mensuel selon le plan choisi (Starter, Pro,
                Business). Le paiement s'effectue via notre prestataire Paystack. L'abonnement se
                renouvelle chaque mois ; vous pouvez l'arrêter à tout moment, l'accès restant actif
                jusqu'à la fin de la période payée. Les montants versés ne sont pas remboursables,
                sauf disposition légale contraire.
            </p>
        </section>
        <section>
            <h2>5. Vos contenus et vos clients</h2>
            <p>
                Vos produits, photos, prix et conversations restent votre propriété. Vous garantissez
                avoir le droit de vendre les produits que vous présentez et vous vous engagez à ne
                pas utiliser le service pour des activités illégales, des produits contrefaits ou
                interdits, ou pour tromper vos clients. L'assistant négocie dans les limites de prix
                que vous fixez ; <strong>les commandes conclues sont des ventes entre vous et vos
                clients</strong> — DjassaBot n'est pas partie à ces ventes.
            </p>
        </section>
        <section>
            <h2>6. Disponibilité</h2>
            <p>
                Nous faisons le maximum pour que le service fonctionne 24h/24 (reconnexion
                automatique, surveillance), mais nous ne pouvons pas garantir une disponibilité
                ininterrompue : le service dépend notamment de WhatsApp, de votre connexion et de
                services tiers. En cas d'interruption prolongée de notre fait, votre seul recours
                est le prolongement de votre abonnement à due proportion.
            </p>
        </section>
        <section>
            <h2>7. Limitation de responsabilité</h2>
            <p>
                Dans la limite permise par la loi, la responsabilité totale de DjassaBot est limitée
                au montant payé au cours des trois derniers mois. Nous ne sommes pas responsables des
                pertes de ventes, de la suspension de votre numéro par WhatsApp, ni des litiges entre
                vous et vos clients.
            </p>
        </section>
        <section>
            <h2>8. Résiliation</h2>
            <p>
                Vous pouvez supprimer votre compte à tout moment. Nous pouvons suspendre un compte en
                cas de violation de ces conditions (spam, fraude, activité illégale), après
                notification sauf urgence.
            </p>
        </section>
        <section>
            <h2>9. Contact</h2>
            <p>
                Pour toute question : <strong>support@djassabot.com</strong> (ou le WhatsApp support
                indiqué dans votre tableau de bord). Droit applicable : droit ivoirien.
            </p>
        </section>
    </LegalLayout>
);

export const Privacy = () => (
    <LegalLayout title="Politique de confidentialité" updated="11 juin 2026">
        <section>
            <h2>1. Qui est concerné</h2>
            <p>
                Cette politique couvre deux types de personnes : <strong>les commerçants</strong> qui
                créent un compte DjassaBot, et <strong>leurs clients</strong> qui discutent avec
                l'assistant sur WhatsApp.
            </p>
        </section>
        <section>
            <h2>2. Données des commerçants</h2>
            <p>
                Nous collectons : nom, email et/ou numéro de téléphone, informations de la boutique
                (produits, prix, adresse, horaires), et données de connexion WhatsApp nécessaires au
                fonctionnement de l'assistant. Le paiement de l'abonnement est traité par Paystack —
                nous ne stockons jamais vos données bancaires.
            </p>
        </section>
        <section>
            <h2>3. Données des clients des commerçants</h2>
            <p>
                Pour que l'assistant fonctionne, nous traitons les messages échangés entre le client
                et le numéro WhatsApp du commerçant : texte des conversations, numéro WhatsApp,
                commandes passées et adresse de livraison communiquée. Ces données sont traitées
                <strong> pour le compte du commerçant</strong>, qui reste responsable de la relation
                avec ses clients. Les images de reçus de paiement sont analysées automatiquement pour
                valider les commandes, puis ne sont pas conservées.
            </p>
        </section>
        <section>
            <h2>4. Intelligence artificielle</h2>
            <p>
                Les réponses de l'assistant sont générées par le modèle Gemini (Google). Le contenu
                des conversations est transmis à ce service pour produire les réponses. Nous ne
                vendons aucune donnée et n'utilisons pas vos conversations pour de la publicité.
            </p>
        </section>
        <section>
            <h2>5. Conservation et sécurité</h2>
            <p>
                Les données sont hébergées chez des prestataires sécurisés (base de données Supabase
                en Europe, serveur applicatif dédié). Les conversations sont conservées tant que le
                compte du commerçant est actif, puis supprimées dans les 90 jours suivant la clôture
                du compte. Les accès sont protégés par authentification et chaque commerce est isolé
                des autres.
            </p>
        </section>
        <section>
            <h2>6. Vos droits</h2>
            <p>
                Commerçant ou client final, vous pouvez demander l'accès, la correction ou la
                suppression de vos données en écrivant à <strong>support@djassabot.com</strong>. Si
                vous êtes client d'un commerçant, vous pouvez aussi exercer ces droits directement
                auprès de lui.
            </p>
        </section>
        <section>
            <h2>7. Services tiers</h2>
            <p>
                Nous utilisons : WhatsApp (messagerie), Google Gemini (IA), Google reCAPTCHA et
                Firebase (sécurité de connexion), Supabase (base de données), Paystack (paiements),
                Resend (emails), Vercel (hébergement web). Chacun applique sa propre politique de
                confidentialité.
            </p>
        </section>
    </LegalLayout>
);

export default Terms;
