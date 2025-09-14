const jwt = require('jsonwebtoken');

/**
 * Generate JWT token
 * @param {Object} user - HOD or Professor document
 * @param {String} role - 'hod' or 'professor'
 * @param {String} [hodId] - required for professor tokens
 * @returns {String} JWT token
 */
const generateToken = (user, role, hodId = null) => {
  const payload = {
    id: user._id,
    role,
  };

  if (role === 'professor' && hodId) {
    payload.hodId = hodId; // ✅ embed parent HOD reference
  }

   if (role === 'student' && hodId) {
    payload.hodId = hodId;
  }
  
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '7d' }
  );
};

/**
 * Verify JWT token
 * @param {String} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

module.exports = {
  generateToken,
  verifyToken
};
