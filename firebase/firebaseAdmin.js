const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // Path is relative to server.js or backend root

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;