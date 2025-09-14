/**
 * Send a standardized success response
 * @param {Object} res - Express response object
 * @param {Object|Array} data - Data to send in response
 * @param {Number} [statusCode=200] - HTTP status code (optional, defaults to 200)
 */
const successResponse = (res, data = {}, statusCode = 200) => {
  // If third parameter is not a number, treat it as message and adjust arguments
  if (typeof statusCode === 'string') {
    data = { message: statusCode, ...data };
    statusCode = 200;
  }

  return res.status(statusCode).json({
    success: true,
    ...data
  });
};
  
  /**
   * Send a standardized error response
   * @param {Object} res - Express response object
   * @param {String} message - Error message
   * @param {Number} statusCode - HTTP status code (default: 400)
   */
  const errorResponse = (res, message, statusCode = 400) => {
    return res.status(statusCode).json({
      success: false,
      error: message
    });
  };
  
  module.exports = {
    successResponse,
    errorResponse
  };
  