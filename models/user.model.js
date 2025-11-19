const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// This is the blueprint for our User
const userSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true 
  },
  email: {
    type: String,
    required: true,
    unique: true,    
    trim: true,
    lowercase: true  
  },
  password: {
    type: String,
    required: true
  },
  
  // --- THIS IS THE NEW SECTION ---
  role: {
    type: String,
    enum: ['Reader', 'Creator', 'Admin'], // Defines the possible roles
    default: 'Reader', // Every new user will be a 'Reader'
    required: true
  }
  // --- END OF NEW SECTION ---

}, {
  // This automatically adds "createdAt" and "updatedAt" fields
  timestamps: true
});

// This creates the "User" model that we can use in other files
const User = mongoose.model('User', userSchema);

module.exports = User;