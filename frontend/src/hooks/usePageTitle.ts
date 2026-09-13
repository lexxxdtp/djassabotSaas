import { useEffect } from 'react';

const SUFFIXE = 'DjassaBot';

/**
 * Donne son titre à l'onglet.
 *
 * Toutes les routes partageaient le même `<title>` figé dans index.html : un
 * vendeur avec plusieurs onglets ouverts ne pouvait pas les distinguer, et les
 * moteurs de recherche voyaient un site d'une seule page.
 *
 * Le titre précédent est restauré au démontage, pour qu'une page qui en pose un
 * ne laisse pas le sien derrière elle en revenant en arrière.
 */
export function usePageTitle(titre: string) {
    useEffect(() => {
        const precedent = document.title;
        document.title = titre ? `${titre} · ${SUFFIXE}` : SUFFIXE;
        return () => { document.title = precedent; };
    }, [titre]);
}
