const express = require('express');
const router = express.Router();
const hodController = require('../controllers/hod.controller');
const { authenticate, authorizeHOD } = require('../middleware/auth.middleware');
const {
  validateHODRegistration,
  validateOTP,          // email + otp (registration email verify)
  validateLogin,
  validateEmailLogin,   // ✅ new
  validateHODUpdate,
  validateOTPOnly       // otp only (update verify + delete confirm)
} = require('../middleware/validation.middleware');

// Public routes
router.post('/register', validateHODRegistration, hodController.registerHOD);
router.post('/verify-otp', validateOTP, hodController.verifyOTPHandler);
router.post('/resend-otp', hodController.resendOTP);

// Login via username + password
router.post('/login', validateLogin, hodController.loginHOD);

// ✅ New login route via email + altPassword
router.post('/login-email', validateEmailLogin, hodController.loginHODByEmail);

// Protected routes
router.get('/profile', authenticate, authorizeHOD, hodController.getHODProfile);

// Update HOD (email/password → OTP, username/college direct)
router.put(
  '/update',
  authenticate,
  authorizeHOD,
  validateHODUpdate,
  hodController.updateHOD
);

// Verify OTP for email/password update (auth only; no authorizeHOD)
router.post(
  '/verify-update-otp',
  authenticate,
  validateOTPOnly,
  hodController.verifyUpdateOTP
);

// Delete flow with OTP
router.post(
  '/delete-request',
  authenticate,
  authorizeHOD,
  hodController.sendDeleteOTP
);

router.post(
  '/confirm-delete',
  authenticate,
  authorizeHOD,
  validateOTPOnly,
  hodController.confirmDeleteHOD
);

module.exports = router;
