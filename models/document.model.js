const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const documentSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Tech', 'Business', 'Art', 'Health', 'Travel', 'Other'], // Defines possible categories
    default: 'Other'
  },
  price: {
    type: Number,
    default: 0
  },
  
  // --- CORE FIX: CHANGED TO ARRAY ---
  fileUrl: {
    type: [String], // <--- This allows storing multiple file paths (the array)
    required: true
  },
  // --- END CORE FIX ---

  coverImage: {
    type: String,
    default: '' 
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Links the document to the Creator
    required: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

module.exports = mongoose.model('Document', documentSchema);