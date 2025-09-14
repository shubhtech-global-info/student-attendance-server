const nodemailer = require('nodemailer');

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send email
 * @param {Object} options - Email options
 * @param {String} options.to - Recipient email
 * @param {String} options.subject - Email subject
 * @param {String} options.text - Plain text content
 * @param {String} options.html - HTML content
 * @returns {Promise} - Nodemailer info object
 */
const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text || '',
      html: options.html || ''
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Email could not be sent');
  }
};

/**
 * Send OTP email
 * @param {String} email - Recipient email
 * @param {String} otp - One-time password
 * @param {String} name - Recipient name
 * @returns {Promise} - Nodemailer info object
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
