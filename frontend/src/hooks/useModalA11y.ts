import { useEffect, useRef } from 'react';

/**
 * Rend une modale utilisable au clavier.
 *
 * Aucune modale du projet ne déclarait `role="dialog"`, ne se fermait avec
 * Échap, ni ne retenait le focus. Conséquences concrètes : un vendeur au
 * clavier tabulait derrière la modale sans le voir, se retrouvait à modifier la
 * page cachée dessous, et n'avait aucun moyen de fermer sans viser la croix.
 * Un lecteur d'écran, lui, ne savait même pas qu'une fenêtre s'était ouverte.
 *
 * Retourne le ref à poser sur le conteneur de la modale.
 *
 * `enabled` vaut false quand la modale est montée mais fermée : les composants
 * qui rendent `null` tant qu'ils ne sont pas ouverts appellent quand même ce
 * hook, et sans ce drapeau la touche Échap resterait écoutée en permanence.
 */
export function useModalA11y(onClose: () => void, enabled = true) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!enabled) return;
        const container = containerRef.current;
        // On note qui avait le focus pour le lui rendre à la fermeture.
        const previouslyFocused = document.activeElement as HTMLElement | null;

        const focusables = () => Array.from(
            container?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
            ) ?? []
        ).filter(el => el.offsetParent !== null);

        // Entrer dans la modale plutôt que de laisser le focus derrière elle.
        (focusables()[0] ?? container)?.focus();

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onClose();
                return;
            }
            if (event.key !== 'Tab') return;

            const items = focusables();
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];

            // Tabulation circulaire : on ne sort pas de la modale par accident.
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            previouslyFocused?.focus?.();
        };
    }, [onClose, enabled]);

    return containerRef;
}
