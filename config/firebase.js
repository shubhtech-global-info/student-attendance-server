// config/firebase.js
const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');

// Basic presence checks
console.log('FIREBASE_PROJECT_ID set?', !!process.env.FIREBASE_PROJECT_ID);
console.log('FIREBASE_CLIENT_EMAIL set?', !!process.env.FIREBASE_CLIENT_EMAIL);
console.log('FIREBASE_PRIVATE_KEY set?', !!process.env.FIREBASE_PRIVATE_KEY);

try {
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || '';
  let privateKey = privateKeyRaw;

  // Handle both escaped "\n" and real multiline keys
  if (privateKeyRaw.includes('\\n')) {
    privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
    console.log('[firebase] Firebase Admin initialized');
  }
} catch (initErr) {
  console.error('[firebase] Initialization error:', initErr);
}

// Export both admin and messaging instance
let messaging;
try {
  messaging = getMessaging();
} catch {
  try {
    messaging = admin.messaging();
  } catch {
    console.error('[firebase] Messaging could not be obtained');
    messaging = null;
  }
}

module.exports = { admin, messaging };
