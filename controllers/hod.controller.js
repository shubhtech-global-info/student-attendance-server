const HOD = require('../models/hod.model');
const { generateToken } = require('../config/jwt.config');
const { generateOTP, verifyOTP } = require('../utils/otp.utils');
const { sendOTPEmail } = require('../config/email.config');
const { successResponse, errorResponse } = require('../utils/response.utils');

/**
 * @desc    Register a new HOD
 * @route   POST /api/hods/register
 * @access  Public
 */
const registerHOD = async (req, res) => {
  try {
    const { collegeName, username, password, email, altPassword } = req.body;

    // Check if HOD already exists
    const hodExists = await HOD.findOne({
      $or: [{ email }, { username }]
    });

    if (hodExists) {
      if (hodExists.email === email) {
        return errorResponse(res, 'Email already registered', 400);
      }
      return errorResponse(res, 'Username already taken', 400);
    }

    // Generate OTP
    const { otp, expiresAt } = generateOTP();

    // Create HOD with unverified status
    const hod = await HOD.create({
      collegeName,
      username,
      password,
      altPassword,
      email,
      verified: false,
      otp: {
        code: otp,
        expiresAt
      }
    });

    // Send OTP email
    await sendOTPEmail(email, otp, collegeName);

    return successResponse(
      res,
      {
        message:
          'Registration initiated. Please verify your email with the OTP sent.',
        hodId: hod._id,
        email: hod.email
      },
      201
    );
  } catch (error) {
    console.error('Register HOD Error:', error);
    return errorResponse(res, 'Server error during registration', 500);
  }
};

/**
 * @desc    Verify HOD email with OTP
 * @route   POST /api/hods/verify-otp
 * @access  Public
 */
const verifyOTPHandler = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const hod = await HOD.findOne({ email });
    if (!hod) return errorResponse(res, 'HOD not found', 404);

    if (hod.verified) {
      return errorResponse(res, 'Email already verified', 400);
    }

    // verifyOTP now returns "valid" | "expired" | "invalid"
    const status = verifyOTP(otp, hod.otp?.code, hod.otp?.expiresAt);

    if (status === 'invalid') {
      return errorResponse(res, 'Invalid OTP', 400);
    }

    if (status === 'expired') {
      // clear expired OTP so DB doesn't keep stale OTPs
      hod.otp = undefined;
      await hod.save();
      return errorResponse(res, 'OTP expired. Please request a new one.', 400);
    }

    // valid
    hod.verified = true;
    hod.otp = undefined;
    await hod.save();

    const token = generateToken(hod, 'hod');

    return successResponse(res, {
      message: 'Email verified successfully',
      token,
      hod: {
        id: hod._id,
        username: hod.username,
        collegeName: hod.collegeName,
        email: hod.email
      }
    });
  } catch (error) {
    console.error('OTP Verification Error:', error);
    return errorResponse(res, 'Server error during verification', 500);
  }
};

/**
 * @desc    Resend OTP to HOD email
 * @route   POST /api/hods/resend-otp
 * @access  Public
 */
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const hod = await HOD.findOne({ email });
    if (!hod) return errorResponse(res, 'HOD not found', 404);

    if (hod.verified) {
      return errorResponse(res, 'Email already verified', 400);
    }

    // If stored OTP exists and is expired, clear it first (cleanup)
    if (hod.otp?.expiresAt && new Date() > new Date(hod.otp.expiresAt)) {
      hod.otp = undefined;
    }

    const { otp, expiresAt } = generateOTP();
    hod.otp = { code: otp, expiresAt };
    await hod.save();

    await sendOTPEmail(email, otp, hod.collegeName);

    return successResponse(res, {
      message: 'OTP resent successfully',
      email: hod.email
    });
  } catch (error) {
    console.error('Resend OTP Error:', error);
    return errorResponse(res, 'Server error while resending OTP', 500);
  }
};

/**
 * @desc    Login HOD
 * @route   POST /api/hods/login
 * @access  Public
 */
const loginHOD = async (req, res) => {
  try {
    const { username, password } = req.body;

    const hod = await HOD.findOne({ username });
    if (!hod) return errorResponse(res, 'Invalid credentials', 401);

    if (!hod.verified) {
      return errorResponse(
        res,
        'Email not verified. Please verify your email first.',
        401
      );
    }

    const isMatch = await hod.comparePassword(password);
    if (!isMatch) return errorResponse(res, 'Invalid credentials', 401);

    const token = generateToken(hod, 'hod');

    return successResponse(res, {
      message: 'Login successful',
      token,
      hod: {
        id: hod._id,
        username: hod.username,
        collegeName: hod.collegeName,
        email: hod.email
      }
    });
  } catch (error) {
    console.error('Login HOD Error:', error);
    return errorResponse(res, 'Server error during login', 500);
  }
};

/**
 * @desc    Get HOD profile
 * @route   GET /api/hods/profile
 * @access  Private
 */
const getHODProfile = async (req, res) => {
  try {
    const hod = await HOD.findById(req.user.id).select('-password -otp -deleteOtp');
    if (!hod) return errorResponse(res, 'HOD not found', 404);

    return successResponse(res, { hod });
  } catch (error) {
    console.error('Get HOD Profile Error:', error);
    return errorResponse(res, 'Server error while fetching profile', 500);
  }
};

/**
 * @desc    Update HOD profile
 * @route   PUT /api/hods/update
 * @access  Private
 */
// ================== Update HOD Profile ==================
const updateHOD = async (req, res) => {
  try {
    const { collegeName, username, email, password, altPassword } = req.body;
    const hod = await HOD.findById(req.user.id);

    if (!hod) return errorResponse(res, 'HOD not found', 404);

    let otpTriggered = false;

    // Username update
    if (username && username !== hod.username) {
      const usernameExists = await HOD.findOne({ username });
      if (usernameExists) return errorResponse(res, 'Username already taken', 400);
      hod.username = username;
    }

    // College name update
    if (collegeName) hod.collegeName = collegeName;

    // Email/Password/AltPassword update -> needs OTP
    if ((email && email !== hod.email) || password || altPassword) {
      const { otp, expiresAt } = generateOTP();
      hod.otp = { code: otp, expiresAt };
      hod.pendingUpdates = {};

      if (email && email !== hod.email) {
        const emailExists = await HOD.findOne({ email });
        if (emailExists) return errorResponse(res, 'Email already in use', 400);

        hod.pendingUpdates.email = email;
        hod.verified = false;
      }

      if (password) {
        hod.pendingUpdates.password = password;
      }

      if (altPassword) {
        hod.pendingUpdates.altPassword = altPassword;
      }

      otpTriggered = true;
      await sendOTPEmail(email || hod.email, otp, hod.collegeName);
    }

    await hod.save();

    if (otpTriggered) {
      return successResponse(res, {
        message: 'OTP sent to your email. Please verify to confirm changes.',
        email: email || hod.email
      });
    }

    return successResponse(res, {
      message: 'Profile updated successfully',
      hod: {
        id: hod._id,
        username: hod.username,
        collegeName: hod.collegeName,
        email: hod.email,
        verified: hod.verified
      }
    });
  } catch (error) {
    console.error('Update HOD Error:', error);
    return errorResponse(res, 'Server error while updating profile', 500);
  }
};


/**
 * @desc    Verify OTP for email/password update
 * @route   POST /api/hods/verify-update-otp
 * @access  Private
 */
const verifyUpdateOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const hod = await HOD.findById(req.user.id);

    if (!hod || !hod.otp) return errorResponse(res, 'No pending update found', 400);

    const status = verifyOTP(otp, hod.otp.code, hod.otp.expiresAt);
    if (status === 'invalid') {
      return errorResponse(res, 'Invalid OTP', 400);
    }
    if (status === 'expired') {
      // clear expired OTP and pending updates
      hod.otp = undefined;
      hod.pendingUpdates = undefined;
      await hod.save();
      return errorResponse(res, 'OTP expired. Please request update again.', 400);
    }

    // valid -> apply pending updates
    if (hod.pendingUpdates?.email) {
      hod.email = hod.pendingUpdates.email;
      hod.verified = true;
    }

    if (hod.pendingUpdates?.password) {
      hod.password = hod.pendingUpdates.password;
    }

    if (hod.pendingUpdates?.altPassword) {
      hod.altPassword = hod.pendingUpdates.altPassword;
    }

    hod.otp = undefined;
    hod.pendingUpdates = undefined;

    await hod.save();

    return successResponse(res, {
      message: 'Update verified and applied successfully',
      hod: {
        id: hod._id,
        username: hod.username,
        collegeName: hod.collegeName,
        email: hod.email,
        verified: hod.verified
      }
    });
  } catch (error) {
    console.error('Verify Update OTP Error:', error);
    return errorResponse(res, 'Server error during update verification', 500);
  }
};

/**
 * @desc    Send OTP for account deletion
 * @route   POST /api/hods/delete-request
 * @access  Private
 */
const sendDeleteOTP = async (req, res) => {
  try {
    const hod = await HOD.findById(req.user.id);
    if (!hod) return errorResponse(res, 'HOD not found', 404);

    const { otp, expiresAt } = generateOTP();
    hod.deleteOtp = { code: otp, expiresAt };
    await hod.save();

    await sendOTPEmail(hod.email, otp, hod.collegeName);

    return successResponse(res, {
      message: 'OTP sent to your registered email to confirm deletion',
      email: hod.email
    });
  } catch (error) {
    console.error('Send Delete OTP Error:', error);
    return errorResponse(res, 'Failed to send delete OTP', 500);
  }
};

/**
 * @desc    Confirm HOD deletion with OTP
 * @route   POST /api/hods/confirm-delete
 * @access  Private
 */
const confirmDeleteHOD = async (req, res) => {
  try {
    const { otp } = req.body;
    const hodId = req.user.id;

    const hod = await HOD.findById(hodId);
    if (!hod) return errorResponse(res, 'HOD not found', 404);

    if (!hod.deleteOtp) return errorResponse(res, 'No delete request found', 400);

    const status = verifyOTP(otp, hod.deleteOtp.code, hod.deleteOtp.expiresAt);
    if (status === 'invalid') {
      return errorResponse(res, 'Invalid OTP', 400);
    }
    if (status === 'expired') {
      // cleanup and inform user
      hod.deleteOtp = undefined;
      await hod.save();
      return errorResponse(res, 'Delete OTP expired. Please request deletion again.', 400);
    }

    // valid -> delete HOD. Cascade is handled by model middleware (findOneAndDelete)
    await HOD.findByIdAndDelete(hodId);

    return successResponse(res, {
      message: 'HOD and all related data deleted successfully'
    });
  } catch (error) {
    console.error('Confirm Delete Error:', error);
    return errorResponse(res, 'Server error during delete confirmation', 500);
  }
};


/**
 * @desc    Login HOD with Email + Alt Password
 * @route   POST /api/hods/login-email
 * @access  Public
 */
const loginHODByEmail = async (req, res) => {
  try {
    const { email, altPassword } = req.body;

    const hod = await HOD.findOne({ email });
    if (!hod) return errorResponse(res, 'Invalid credentials', 401);

    if (!hod.verified) {
      return errorResponse(res, 'Email not verified. Please verify your email first.', 401);
    }

    const isMatch = await hod.compareAltPassword(altPassword);
    if (!isMatch) return errorResponse(res, 'Invalid credentials', 401);

    const token = generateToken(hod, 'hod');

    return successResponse(res, {
      message: 'Login successful (email + altPassword)',
      token,
      hod: {
        id: hod._id,
        username: hod.username,
        collegeName: hod.collegeName,
        email: hod.email
      }
    });
  } catch (error) {
    console.error('Login HOD by Email Error:', error);
    return errorResponse(res, 'Server error during login', 500);
  }
};

module.exports = {
  registerHOD,
  verifyOTPHandler,
  resendOTP,
  loginHOD,
  loginHODByEmail,
  getHODProfile,
  updateHOD,
  verifyUpdateOTP,
  sendDeleteOTP,
  confirmDeleteHOD
};
