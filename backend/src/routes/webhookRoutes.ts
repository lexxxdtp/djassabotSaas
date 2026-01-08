import { Router } from 'express';
import { verifyWebhook, receiveWebhook } from '../controllers/webhookController';

const router = Router();

router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

export default router;
