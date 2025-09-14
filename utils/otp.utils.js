/**
 * Generate a random 6-digit OTP
 * @returns {Object} Object containing OTP and expiry timestamp
 */
const generateOTP = () => {
    // Generate a random 6-digit number
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry time (default: 10 minutes from now)
    const expiryMinutes = process.env.OTP_EXPIRY_MINUTES || 10;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    
    return { otp, expiresAt };
  };
  
  /**
   * Verify if OTP is valid and not expired
   * @param {String} inputOTP - OTP provided by user
   * @param {String} storedOTP - OTP stored in database
   * @param {Date} expiresAt - Expiry timestamp
   * @returns {Boolean} True if OTP is valid and not expired
   */
  /**
 * Verify if OTP is valid and not expired
 * @param {String} inputOTP - OTP provided by user
 * @param {String} storedOTP - OTP stored in database
 * @param {Date} expiresAt - Expiry timestamp
 * @returns {"valid" | "expired" | "invalid"}
 */
const verifyOTP = (inputOTP, storedOTP, expiresAt) => {
  if (!storedOTP || !expiresAt) {
    return "invalid";
  }

  if (inputOTP !== storedOTP) {
    return "invalid";
  }

  const now = new Date();
  if (now > new Date(expiresAt)) {
    return "expired";
  }

  return "valid";
};

  
  module.exports = {
    generateOTP,
    verifyOTP
  };
  