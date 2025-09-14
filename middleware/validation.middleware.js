const { errorResponse } = require('../utils/response.utils');

/**
 * Validate HOD registration data
 */
const validateHODRegistration = (req, res, next) => {
  const { collegeName, username, password, altPassword, email } = req.body;

  if (!collegeName || !username || !password || !altPassword || !email) {
    return errorResponse(res, 'All fields are required', 400);
  }

  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(email)) {
    return errorResponse(res, 'Please provide a valid email address', 400);
  }

  if (username.length < 3) {
    return errorResponse(res, 'Username must be at least 3 characters long', 400);
  }

  if (password.length < 6) {
    return errorResponse(res, 'Password must be at least 6 characters long', 400);
  }

  if (altPassword.length < 6) {
    return errorResponse(res, 'Secondary password must be at least 6 characters long', 400);
  }

  next();
};

/**
 * Validate email + OTP (for registration email verify)
 */
const validateOTP = (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return errorResponse(res, 'Email and OTP are required', 400);
  }

  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(email)) {
    return errorResponse(res, 'Please provide a valid email address', 400);
  }

  const otpRegex = /^\d{6}$/;
  if (!otpRegex.test(otp)) {
    return errorResponse(res, 'OTP must be 6 digits', 400);
  }

  next();
};

/**
 * Validate only OTP in body (for update verify + delete confirm)
 */
const validateOTPOnly = (req, res, next) => {
  const { otp } = req.body;

  if (!otp) {
    return errorResponse(res, 'OTP is required', 400);
  }

  const otpRegex = /^\d{6}$/;
  if (!otpRegex.test(otp)) {
    return errorResponse(res, 'OTP must be 6 digits', 400);
  }

  next();
};

/**
 * Validate login data (username + password)
 */
const validateLogin = (req, res, next) => {
  const username =
    req.body && typeof req.body.username !== 'undefined'
      ? String(req.body.username).trim()
      : '';
  const password =
    req.body && typeof req.body.password !== 'undefined'
      ? String(req.body.password)
      : '';

  if (!username || !password) {
    return errorResponse(res, 'Username and password are required', 400);
  }

  req.body.username = username;
  req.body.password = password;

  next();
};

/**
 * Validate login via email + altPassword
 */
const validateEmailLogin = (req, res, next) => {
  const email =
    req.body && typeof req.body.email !== 'undefined'
      ? String(req.body.email).trim()
      : '';
  const altPassword =
    req.body && typeof req.body.altPassword !== 'undefined'
      ? String(req.body.altPassword)
      : '';

  if (!email || !altPassword) {
    return errorResponse(res, 'Email and secondary password are required', 400);
  }

  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(email)) {
    return errorResponse(res, 'Please provide a valid email address', 400);
  }

  req.body.email = email;
  req.body.altPassword = altPassword;

  next();
};

/**
 * Validate professor data
 */
const validateProfessor = (req, res, next) => {
  const { name, username, password } = req.body;

  if (!name || !username || !password) {
    return errorResponse(res, 'Name, username, and password are required', 400);
  }

  if (username.length < 3) {
    return errorResponse(res, 'Username must be at least 3 characters long', 400);
  }

  if (password.length < 6) {
    return errorResponse(res, 'Password must be at least 6 characters long', 400);
  }

  next();
};

/**
 * Validate HOD update data (partial update allowed)
 */
const validateHODUpdate = (req, res, next) => {
  const { collegeName, username, password, email, altPassword } = req.body;

  if (!collegeName && !username && !password && !email && !altPassword) {
    return errorResponse(res, 'At least one field must be provided to update', 400);
  }

  const directFields = [];
  const sensitiveFields = [];

  if (username) directFields.push('username');
  if (collegeName) directFields.push('collegeName');
  if (email) sensitiveFields.push('email');
  if (password) sensitiveFields.push('password');
  if (altPassword) sensitiveFields.push('altPassword');

  if (directFields.length > 0 && sensitiveFields.length > 0) {
    return errorResponse(
      res,
      `You cannot update [${directFields.join(', ')}] together with [${sensitiveFields.join(', ')}]. Please update them separately.`,
      400
    );
  }

  if (email) {
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, 'Please provide a valid email address', 400);
    }
  }

  if (username && username.length < 3) {
    return errorResponse(res, 'Username must be at least 3 characters long', 400);
  }

  if ((password && password.length < 6) || (altPassword && altPassword.length < 6)) {
    return errorResponse(res, 'Passwords must be at least 6 characters long', 400);
  }

  next();
};


/**
 * Validate Student for login
 */
const validateStudentLogin = (req, res, next) => {
  const { enrollmentNumber } = req.body;
  if (!enrollmentNumber) {
    return errorResponse(res, 'Enrollment number is required', 400);
  }
  next();
};
module.exports = {
  validateHODRegistration,
  validateOTP,
  validateOTPOnly,
  validateLogin,
  validateEmailLogin, 
  validateProfessor,
  validateHODUpdate,
  validateStudentLogin
};
