import { Resend } from 'resend';

// Configurez votre clé d'API Resend dans votre fichier .env
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

/**
 * Envoie un email de vérification contenant un lien.
 */
export const sendVerificationEmail = async (email: string, token: string) => {
    try {
        // En vrai, utiliser l'URL front-end en production
        const verificationLink = `http://localhost:5173/verify-email?token=${token}`;

        const data = await resend.emails.send({
            from: 'DjassaBot <onboarding@resend.dev>', // Modifiez avec votre domaine validé sur Resend
            to: [email],
            subject: 'Vérifiez votre adresse email sur DjassaBot',
            html: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4F46E5;">Bienvenue sur DjassaBot !</h2>
                    <p>Merci de vous être inscrit. Pour activer votre compte et commencer à utiliser votre assistant, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous :</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Vérifier mon email
                        </a>
                    </div>
                    <p>Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :</p>
                    <p style="word-break: break-all; color: #666;">${verificationLink}</p>
                    <p>À très vite,<br/>L'équipe DjassaBot.</p>
                </div>
            `,
        });

        console.log(`[Resend] Email de vérification envoyé à ${email}`, data);
        return { success: true, data };
    } catch (error) {
        console.error(`[Resend] Erreur lors de l'envoi de l'email à ${email}:`, error);
        return { success: false, error };
    }
};
