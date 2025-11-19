const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model.js'); // Import your User model
const admin = require('../firebase/firebaseAdmin.js');

// File: auth.routes.js

// ... existing imports ...

// --- EMAIL/PASSWORD LOGIN ROUTE (Ensure this is present!) ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Compare the password with the hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Create and sign the JWT payload
    const payload = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '3h' },
      (err, token) => {
        if (err) throw err;
        res.status(200).json({ token: token, user: payload.user });
      }
    );

  } catch (error) {
    console.error('LOGIN ERROR:', error);
    res.status(500).json({ message: 'Server error, please try again.' });
  }
});

// ... The /google-login route should be immediately after this ...
// --- GOOGLE LOGIN/SIGNUP ROUTE ---
router.post('/google-login', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    // 1. Verify the ID Token with Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, name } = decodedToken;

    // 2. Check if user exists in YOUR database
    let user = await User.findOne({ email: email });

    if (!user) {
      // 3. User does not exist, register them (Auto-generate a secure password)
      const salt = await bcrypt.genSalt(10);
      const temporaryPassword = await bcrypt.hash(Date.now().toString(), salt); // Use timestamp as secure placeholder
      
      const newUser = new User({
        name: name || email.split('@')[0],
        email: email,
        password: temporaryPassword,
        role: 'Reader'
      });
      user = await newUser.save();
    }

    // 4. Create your own platform JWT (using your existing logic)
    const payload = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '3h' },
      (err, token) => {
        if (err) throw err;
        res.status(200).json({ token: token, user: payload.user });
      }
    );

  } catch (error) {
    console.error('FIREBASE AUTH ERROR:', error);
    res.status(500).json({ message: 'Token verification failed.' });
  }
});

module.exports = router;
