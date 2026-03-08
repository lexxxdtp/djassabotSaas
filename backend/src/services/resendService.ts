import { Resend } from 'resend';

// Configurez votre clé d'API Resend dans votre fichier .env
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

/**
 * Envoie un email OTP (code à 6 chiffres) pour la vérification d'email lors de l'inscription.
 */
export const sendOtpEmail = async (email: string, code: string) => {
    try {
        const data = await resend.emails.send({
            from: 'DjassaBot <onboarding@resend.dev>',
            to: [email],
            subject: `${code} - Votre code de vérification DjassaBot`,
            html: `
                <div style="font-family: 'Segoe UI', sans-serif; color: #333; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 40px 20px;">
                    <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                        <h2 style="color: #4F46E5; margin-top: 0;">🔐 Code de vérification</h2>
                        <p>Bonjour ! Voici votre code de vérification pour créer votre compte DjassaBot :</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <span style="background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; padding: 16px 40px; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 12px; display: inline-block;">${code}</span>
                        </div>
                        <p style="color: #666; font-size: 14px;">⏱️ Ce code expire dans <strong>10 minutes</strong>. Ne le partagez avec personne.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                        <p style="color: #999; font-size: 12px;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
                    </div>
                </div>
            `,
        });

        console.log(`[Resend] OTP email envoyé à ${email}`, data);
        return { success: true, data };
    } catch (error) {
        console.error(`[Resend] Erreur OTP email à ${email}:`, error);
        return { success: false, error };
    }
};

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

/**
 * Envoie un email contenant un lien pour réinitialiser le mot de passe.
 */
export const sendPasswordResetEmail = async (email: string, token: string) => {
    try {
        const resetLink = `http://localhost:5173/reset-password?token=${token}`;

        const data = await resend.emails.send({
            from: 'DjassaBot <onboarding@resend.dev>',
            to: [email],
            subject: 'Réinitialisation de votre mot de passe DjassaBot',
            html: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #4F46E5;">Réinitialisation de mot de passe</h2>
                    <p>Bonjour,</p>
                    <p>Nous avons reçu une demande pour réinitialiser le mot de passe de votre compte DjassaBot.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Réinitialiser mon mot de passe
                        </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">⏱️ Ce lien est valide pendant <strong>1 heure</strong>.</p>
                    <p>Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :</p>
                    <p style="word-break: break-all; color: #666; font-size: 12px;">${resetLink}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                    <p style="color: #999; font-size: 12px;">Si vous n'avez pas demandé à réinitialiser votre mot de passe, vous pouvez ignorer cet email.</p>
                </div>
            `,
        });

        console.log(`[Resend] Email de réinitialisation de mot de passe envoyé à ${email}`, data);
        return { success: true, data };
    } catch (error) {
        console.error(`[Resend] Erreur lors de l'envoi de l'email de réinitialisation à ${email}:`, error);
        return { success: false, error };
    }
};
