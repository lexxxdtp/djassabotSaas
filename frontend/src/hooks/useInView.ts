import { useEffect, useRef, useState } from 'react';

/**
 * useInView — IntersectionObserver hook for scroll-triggered reveals.
 *
 * Returns a ref to attach to the target element and a boolean that flips to
 * true once the element enters the viewport. Triggers once by default (won't
 * re-hide on scroll-up).
 *
 * @param margin - rootMargin string (e.g. "-100px" to fire 100px before entry)
 * @param once   - if true, stops observing after first reveal (default true)
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
    margin: string = '-80px',
    once: boolean = true
) {
    const ref = useRef<T | null>(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        // SSR/legacy guard — IntersectionObserver missing → reveal immediately.
        if (typeof IntersectionObserver === 'undefined') {
            setInView(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setInView(true);
                    if (once) observer.unobserve(node);
                } else if (!once) {
                    setInView(false);
                }
            },
            { rootMargin: margin, threshold: 0.05 }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [margin, once]);

    return { ref, inView };
}
