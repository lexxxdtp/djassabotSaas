import { AsyncLocalStorage } from 'node:async_hooks';
import type { Session } from './sessionService';

export const SIMULATION_USER_ID = 'playground-session';
const TTL_MS = 30 * 60 * 1000;
const MAX_SIMULATIONS = 1000;
interface Simulation { tenantId: string; session?: Session; touchedAt: number; busy: boolean }
const simulations = new Map<string, Simulation>();
const context = new AsyncLocalStorage<Simulation>();

export class SimulationBusyError extends Error {}

/** Une portée asynchrone séparée, jamais listée ni persistée parmi les clients. */
export function simulationScope(tenantId: string): Simulation | undefined {
    const scope = context.getStore();
    if (scope && scope.tenantId !== tenantId) throw new Error('Simulation hors de sa boutique');
    return scope;
}

export async function runSimulation<T>(tenantId: string, action: () => Promise<T>): Promise<T> {
    if (!tenantId) throw new Error('Boutique requise');
    const now = Date.now();
    for (const [key, value] of simulations) {
        if (!value.busy && now - value.touchedAt >= TTL_MS) simulations.delete(key);
    }
    let scope = simulations.get(tenantId);
    if (scope?.busy) throw new SimulationBusyError('Un test est déjà en cours');
    if (!scope) {
        if (simulations.size >= MAX_SIMULATIONS) {
            const oldest = [...simulations].filter(([, value]) => !value.busy)
                .sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0];
            if (!oldest) throw new SimulationBusyError('Simulateur occupé');
            simulations.delete(oldest[0]);
        }
        scope = { tenantId, touchedAt: now, busy: false };
        simulations.set(tenantId, scope);
    }
    scope.busy = true;
    try {
        return await context.run(scope, action);
    } finally {
        scope.busy = false;
        scope.touchedAt = Date.now();
    }
}
