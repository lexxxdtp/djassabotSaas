import { Link } from 'react-router-dom';

export default function Brand({ compact = false }: { compact?: boolean }) {
    return <Link to="/" className="app-brand" aria-label="DjassaBot, accueil">
        <span className="app-brand-mark" aria-hidden="true">D</span>
        {!compact && <span>djassabot<span className="app-brand-register" aria-hidden="true">®</span></span>}
    </Link>;
}
