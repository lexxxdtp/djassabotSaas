import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CheckCheck, RotateCcw, Sparkles } from 'lucide-react';

// Guided explanation of capabilities, never a live merchant conversation.
const scenarios = [
    { label: 'Découvrir', question: 'Comment vous présentez mes produits ?', answer: 'Je m’appuie sur votre catalogue : les photos, les prix et les disponibilités que vous avez renseignés. Je guide le client vers le bon article.', note: 'Votre catalogue est le point de départ.' },
    { label: 'Négocier', question: 'Et si le client demande un petit prix ?', answer: 'On peut discuter ! Mais vous fixez la limite. Le prix minimum de votre boutique est vérifié avant d’ajouter le produit à la commande.', note: 'La négociation respecte vos limites.' },
    { label: 'Commander', question: 'Comment vous finalisez la commande ?', answer: 'Je rassemble les articles choisis et l’adresse du client. Les frais de livraison sont calculés selon vos zones, puis la commande apparaît dans votre espace vendeur.', note: 'Vous retrouvez les informations pour livrer.' },
];

export default function SalesDemo() {
    const [selected, setSelected] = useState(0);
    const [replyVisible, setReplyVisible] = useState(true);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    const select = (index: number) => {
        if (timer.current) clearTimeout(timer.current);
        setSelected(index);
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        setReplyVisible(reduceMotion);
        if (!reduceMotion) timer.current = setTimeout(() => setReplyVisible(true), 700);
    };

    return <div className="lp-demo-card">
        <div className="lp-demo-header"><span className="lp-bot-avatar">d.</span><div><strong>DjassaBot</strong><small>Découvrez votre futur vendeur</small></div><span className="lp-demo-badge">DÉMO</span></div>
        <div className="lp-demo-tabs" role="group" aria-label="Choisir une étape de la démonstration">{scenarios.map((scenario, i) => <button key={scenario.label} aria-pressed={selected === i} onClick={() => select(i)}><span>0{i + 1}</span>{scenario.label}</button>)}</div>
        <div className="lp-demo-messages">
            <span className="lp-chat-label">VOUS AVEZ LA PAROLE</span>
            <div className="lp-demo-question">{scenarios[selected].question}<CheckCheck size={14} /></div>
            <div className="lp-demo-answer-wrap" aria-live="polite" aria-atomic="true" aria-busy={!replyVisible}>
                {replyVisible ? <div className="lp-demo-answer"><span className="lp-answer-name"><Sparkles size={13} /> DJASSABOT</span><p>{scenarios[selected].answer}</p></div> : <div className="lp-demo-answer lp-demo-loading"><span className="lp-typing" aria-label="Le bot prépare sa réponse"><i /><i /><i /></span></div>}
            </div>
            <div className={`lp-demo-result ${replyVisible ? 'is-visible' : ''}`}><span>↳</span>{scenarios[selected].note}</div>
        </div>
        <div className="lp-demo-bottom"><button onClick={() => select(selected)} aria-label="Rejouer cette réponse"><RotateCcw size={16} /></button><button onClick={() => select((selected + 1) % scenarios.length)}>{selected === scenarios.length - 1 ? 'Revenir à la découverte' : 'Et ensuite ?'}<span><ArrowUpRight size={18} /></span></button></div>
    </div>;
}
