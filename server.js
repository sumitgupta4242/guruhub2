require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const admin = require('firebase-admin'); // Firebase Admin SDK

// --- 1. IMPORT SERVICE ACCOUNT KEY ---
// NOTE: Ensure your serviceAccountKey.json is in the backend root folder
const serviceAccount = require('./serviceAccountKey.json'); 
const app = express();
const PORT = 4000;
// --- 3. IMPORT API ROUTES ---
const authRoutes = require('./routes/auth.routes.js');
const userRoutes = require('./routes/user.routes.js');
const documentRoutes = require('./routes/document.routes.js');
const paymentRoutes = require('./routes/payment.routes.js');

// --- 4. MIDDLEWARE ---
app.use(cors({
    origin: '*', // Allows requests from any domain
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));// Enables cross-origin requests from your frontend
app.use(express.json()); // Allows the server to accept JSON data

// --- 5. MAKE UPLOADS FOLDER PUBLIC ---
// This serves files so the frontend can access them via URL (http://localhost:4000/uploads/...)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 

// --- 6. CONNECT TO MONGODB ---
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI, {
    // Timeout fix: Prevents the server from hanging indefinitely if connection is slow
    serverSelectionTimeoutMS: 5000, 
})
  .then(() => console.log('✅ Successfully connected to MongoDB!'))
  .catch(err => console.error('❌ MongoDB connection error:', err));


// --- 7. PLUG IN ROUTES ---
app.use('/api/auth', authRoutes);      // Handles /login, /signup, /google-login
app.use('/api/users', userRoutes);    // Handles /become-creator, etc.
app.use('/api/documents', documentRoutes); // Handles /upload, /my-documents, /:id, /delete
app.use('/api/payment', paymentRoutes);   // Handles /create-order, /verify, /creator-stats


// --- 8. START SERVER ---
app.listen(PORT, () => {
  console.log(`📡 Backend server is running on http://localhost:${PORT}`);
});