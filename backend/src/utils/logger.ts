import pino from 'pino';

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    // Rien dans les journaux actuels ne fuit, mais un simple logger.info(req.body)
    // suffirait à y écrire un mot de passe ou un jeton. Ces chemins sont masqués
    // d'avance : la prudence coûte moins cher que la fuite.
    redact: {
        paths: [
            'req.headers.authorization',
            'headers.authorization',
            '*.password',
            '*.passwordHash',
            '*.password_hash',
            '*.token',
            '*.token_value',
            '*.phoneIdToken',
            '*.resetToken',
        ],
        censor: '[masqué]',
    },
    transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
});
