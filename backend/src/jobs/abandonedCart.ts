import cron from 'node-cron';
import { startAbandonedCartCron } from '../services/abandonedCartService';

/**
 * Cron Job Scheduler for Abandoned Cart Reminders
 * 
 * This file is imported in index.ts to automatically start
 * the abandoned cart detection service when the server starts.
 */

console.log('[CRON] 🕐 Initializing Abandoned Cart Scheduler...');

// Start the abandoned cart service
startAbandonedCartCron();

console.log('[CRON] ✅ Abandoned Cart Scheduler initialized successfully');
