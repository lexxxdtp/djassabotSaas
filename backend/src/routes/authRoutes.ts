import express from 'express';
import { authenticateTenant } from '../middleware/auth';
import * as authController from '../controllers/authController';

const router = express.Router();

// Public Routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/send-email-otp', authController.sendEmailOtp);
router.post('/verify-email-otp', authController.verifyEmailOtp);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-phone-reset', authController.verifyPhoneReset);
router.post('/reset-password', authController.resetPassword);

// Protected Routes
router.get('/me', authenticateTenant, authController.getMe);
router.put('/me', authenticateTenant, authController.updateMe);

export default router;
