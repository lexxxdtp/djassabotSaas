// Calculs purs pour la page Analytics (Overview) — séparés du composant
// pour rester testables et réutilisables (preview, futurs tests unitaires).

export interface DashboardOrder {
    id: string;
    total: number;
    createdAt?: string;
    created_at?: string;
    status: string;
    userId: string;
    items: unknown[];
}

export interface ChartPoint {
    name: string;
    sales: number;
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export function orderDate(o: DashboardOrder): number {
    return new Date(o.createdAt || o.created_at || 0).getTime();
}

export function deriveMetrics(orders: DashboardOrder[]) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const startOf7 = now - 7 * day;
    const startOfPrev7 = now - 14 * day;

    const inLast7 = orders.filter(o => orderDate(o) >= startOf7);
    const inPrev7 = orders.filter(o => orderDate(o) >= startOfPrev7 && orderDate(o) < startOf7);

    const revenue7 = inLast7.reduce((s, o) => s + o.total, 0);
    const revenuePrev = inPrev7.reduce((s, o) => s + o.total, 0);
    const orders7 = inLast7.length;
    const ordersPrev = inPrev7.length;

    const pct = (cur: number, prev: number): number | null =>
        prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;

    // Chart : 7 derniers jours calendaires, du plus ancien au plus récent.
    const chartData: ChartPoint[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now - (6 - i) * day);
        const dayTotal = orders
            .filter(o => {
                const od = new Date(orderDate(o));
                return od.getDate() === d.getDate() && od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
            })
            .reduce((s, o) => s + o.total, 0);
        return { name: DAY_LABELS[d.getDay()], sales: dayTotal };
    });

    return {
        revenue7,
        revenueDelta: pct(revenue7, revenuePrev),
        orders7,
        ordersDelta: pct(orders7, ordersPrev),
        avgBasket: orders7 > 0 ? Math.round(revenue7 / orders7) : 0,
        chartData,
        hasSales7: revenue7 > 0,
    };
}
