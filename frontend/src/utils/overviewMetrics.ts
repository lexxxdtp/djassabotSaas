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

/** Montant des commandes, jamais une preuve d'encaissement. */
export function isCountedOrder(o: DashboardOrder): boolean {
    return ['PENDING', 'CONFIRMED', 'PAID', 'SHIPPING', 'SHIPPED', 'DELIVERED'].includes(o.status)
        && Number.isFinite(o.total) && o.total >= 0 && Number.isFinite(orderDate(o));
}

/** Journées d'Abidjan (UTC), indépendantes du fuseau du téléphone. */
export function startOfBusinessDay(now: number): number {
    const date = new Date(now);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function deriveDailyMetrics(orders: DashboardOrder[], now = Date.now()) {
    const start = startOfBusinessDay(now);
    const counted = orders.filter(o => isCountedOrder(o) && orderDate(o) <= now);
    const todayOrders = counted.filter(o => orderDate(o) >= start);
    const yesterdayOrders = counted.filter(o => orderDate(o) >= start - 86400000 && orderDate(o) < start);
    return {
        todayOrders, yesterdayOrders,
        todayRevenue: todayOrders.reduce((sum, o) => sum + o.total, 0),
        yesterdayRevenue: yesterdayOrders.reduce((sum, o) => sum + o.total, 0),
    };
}

export function deriveMetrics(orders: DashboardOrder[], now = Date.now()) {
    const day = 24 * 60 * 60 * 1000;
    const startOf7 = startOfBusinessDay(now) - 6 * day;
    const startOfPrev7 = startOf7 - 7 * day;
    const counted = orders.filter(o => isCountedOrder(o) && orderDate(o) <= now);

    const inLast7 = counted.filter(o => orderDate(o) >= startOf7);
    const inPrev7 = counted.filter(o => orderDate(o) >= startOfPrev7 && orderDate(o) < startOf7);

    const revenue7 = inLast7.reduce((s, o) => s + o.total, 0);
    const revenuePrev = inPrev7.reduce((s, o) => s + o.total, 0);
    const orders7 = inLast7.length;
    const ordersPrev = inPrev7.length;

    const pct = (cur: number, prev: number): number | null =>
        prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;

    // Chart : 7 derniers jours calendaires, du plus ancien au plus récent.
    const chartData: ChartPoint[] = Array.from({ length: 7 }, (_, i) => {
        const dayStart = startOf7 + i * day;
        const d = new Date(dayStart);
        const dayTotal = inLast7
            .filter(o => {
                const date = orderDate(o);
                return date >= dayStart && date < dayStart + day;
            })
            .reduce((s, o) => s + o.total, 0);
        return { name: DAY_LABELS[d.getUTCDay()], sales: dayTotal };
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
