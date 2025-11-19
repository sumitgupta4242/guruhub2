const express = require('express');
const router = express.Router();
const User = require('../models/user.model.js');
const authMiddleware = require('../middleware/auth.middleware.js'); // Import our bouncer

// --- BECOME A CREATOR ROUTE ---
// @route   PUT /api/users/become-creator
// @desc    Update the user's role from Reader to Creator
// @access  Private (we use our authMiddleware)

router.put('/become-creator', authMiddleware, async (req, res) => {
  try {
    // 1. We know *who* the user is because of authMiddleware (req.user)
    const userId = req.user.id;

    // 2. Find the user in the database
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 3. Check if they are already a Creator
    if (user.role === 'Creator') {
      return res.status(400).json({ message: 'User is already a Creator' });
    }

    // 4. Update their role
    user.role = 'Creator';
    await user.save();

    // 5. Send back the updated user info
    res.status(200).json({
      message: 'Congratulations! You are now a Creator.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role, // This will now be "Creator"
      },
    });

  } catch (error) {
    console.error('--- BECOME CREATOR ERROR ---', error);
    res.status(500).json({ message: 'Server error, please try again.' });
  }
});

module.exports = router;