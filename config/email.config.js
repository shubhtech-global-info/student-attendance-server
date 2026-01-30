const axios = require('axios');

/**
 * Send email via Brevo API
 * @param {Object} options - Email options
 * @param {String} options.to - Recipient email
 * @param {String} options.subject - Email subject
 * @param {String} options.text - Plain text content (optional)
 * @param {String} options.html - HTML content (optional)
 * @returns {Promise} - API response
 */
const sendEmail = async (options) => {
  try {
    const payload = {
      sender: {
        name: 'Student Attendance System',
        email: process.env.EMAIL_FROM, // your Brevo sender email
      },
      to: [
        { email: options.to }
      ],
      subject: options.subject,
      textContent: options.text || '',
      htmlContent: options.html || ''
    };

    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      payload,
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY, // your Brevo API key
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    console.log('Email sent via Brevo API:', response.data);
    return response.data;
  } catch (error) {
    console.error("Brevo API ERROR 👉", {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });
    throw new Error('Email could not be sent');
  }
};

/**
 * Send OTP email via Brevo API
 * @param {String} email - Recipient email
 * @param {String} otp - One-time password
 * @param {String} name - Recipient name
 */
const sendOTPEmail = async (email, otp, name = '') => {
  const subject = 'Your OTP for Student Attendance System';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Student Attendance System - Email Verification</h2>
      <p>Hello${name ? ' ' + name : ''},</p>
      <p>Your One-Time Password (OTP) for email verification is:</p>
      <h1 style="font-size: 32px; letter-spacing: 5px; text-align: center; padding: 10px; background-color: #f0f0f0; border-radius: 5px;">${otp}</h1>
      <p>This OTP is valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.</p>
      <p>If you did not request this OTP, please ignore this email.</p>
      <p>Thank you,<br>Student Attendance System Team</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    html
  });
};

module.exports = {
  sendEmail,
  sendOTPEmail
};
