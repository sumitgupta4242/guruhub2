const express = require('express');
const router = express.Router();
const Document = require('../models/document.model.js');
const authMiddleware = require('../middleware/auth.middleware.js');
const upload = require('../middleware/upload.middleware.js');
const fs = require('fs'); // Node's File System module (for deleting files)

// --- Helper: Delete files from local storage ---
const deleteLocalFiles = (filesArray) => {
    if (!filesArray || filesArray.length === 0) return;
    
    filesArray.forEach(filePath => {
        fs.unlink(filePath, (err) => {
            // Log the error but continue execution so the database still updates
            if (err) console.error(`Failed to delete old file: ${filePath}`, err);
        });
    });
};

// --- 1. UPLOAD DOCUMENT ROUTE (POST) ---
// Uses upload.array for multiple files
router.post('/upload', authMiddleware, upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Please upload at least one file.' });
    }
    
    const fileUrls = req.files.map(file => file.path);
    const { title, description, category, price } = req.body;

    const newDocument = new Document({
      title, description, category, price,
      fileUrl: fileUrls, // Saving the ARRAY of paths
      creator: req.user.id
    });

    const savedDocument = await newDocument.save();

    res.status(201).json({
      message: 'Document uploaded successfully!',
      document: savedDocument
    });

  } catch (error) {
    // If saving fails (e.g., validation error), clean up the files Multer already saved
    if (req.files) {
        deleteLocalFiles(req.files.map(file => file.path));
    }
    console.error('--- UPLOAD CRASH ---', error);
    res.status(500).json({ message: 'Upload failed due to server error.' });
  }
});

// --- 2. EDIT/UPDATE DOCUMENT ROUTE (PUT) - Includes Full File Management ---
router.put('/:id', authMiddleware, upload.array('files', 5), async (req, res) => {
  try {
    const docId = req.params.id;
    // Extract metadata and the JSON array of files to keep
    const { title, description, category, price } = req.body;
    const existingFileUrls = JSON.parse(req.body.existingFileUrls || '[]'); // Parse the array from the frontend

    const doc = await Document.findById(docId);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    if (doc.creator.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Authorization denied. You do not own this document.' });
    }

    // --- FILE MANAGEMENT LOGIC ---
    const uploadedFiles = req.files ? req.files.map(file => file.path) : [];
    
    // 1. Identify files to DELETE: Files that are in the DB but not in the 'filesToKeep' list
    const filesToDelete = doc.fileUrl.filter(dbUrl => !existingFileUrls.includes(dbUrl));
    
    // 2. Execute deletion from server storage
    if (filesToDelete.length > 0) {
        deleteLocalFiles(filesToDelete);
    }

    // 3. Construct the FINAL fileUrl array: [FILES TO KEEP] + [NEWLY UPLOADED FILES]
    const finalFileUrl = [...existingFileUrls, ...uploadedFiles];

    if (finalFileUrl.length === 0) {
        return res.status(400).json({ message: 'A document must contain at least one file.' });
    }

    // 4. Update the document data
    doc.title = title || doc.title;
    doc.description = description || doc.description;
    doc.category = category || doc.category;
    doc.price = price !== undefined ? price : doc.price;
    doc.fileUrl = finalFileUrl; // <-- The new combined array

    await doc.save();
    const updatedDoc = await Document.findById(docId).populate('creator', 'name');

    res.json({ message: 'Document updated successfully!', document: updatedDoc });

  } catch (error) {
    console.error('--- EDIT ERROR ---', error);
    res.status(500).json({ message: 'Server error during update.' });
  }
});

// --- 3. DELETE DOCUMENT ROUTE (DELETE) - Includes File Cleanup ---
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        
        if (!doc) {
            return res.status(404).json({ message: 'Document not found.' });
        }

        if (doc.creator.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Authorization denied. You do not own this document.' });
        }
        
        // Delete the associated files from the server
        deleteLocalFiles(doc.fileUrl);
        
        // Delete the document record from MongoDB
        await doc.deleteOne();

        res.json({ message: 'Document deleted successfully!' });

    } catch (error) {
        console.error('DELETE ERROR:', error);
        res.status(500).json({ message: 'Server error during deletion.' });
    }
});


// -----------------------------------------------------------
// --- ROUTING ORDER FIXES (MUST BE IN THIS ORDER) ---
// -----------------------------------------------------------

// A. SPECIFIC ROUTE FOR DASHBOARD (Prevents CastError crash)
router.get('/my-documents', authMiddleware, async (req, res) => {
  try {
    const documents = await Document.find({ creator: req.user.id }).sort({ createdAt: -1 }).exec(); 
    
    if (!documents) {
        return res.json([]); 
    }
    
    res.json(documents);
  } catch (error) {
    console.error('--- CRITICAL CRASH: /my-documents FAILED ---', error); 
    res.status(500).json([]); // Send an empty array to prevent the frontend crash
  }
});

// B. WILDCARD ROUTE (General GET /:id)
router.get('/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id).populate('creator', 'name');
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.json(document);
  } catch (error) {
    console.error('Error fetching single document:', error); 
    res.status(500).json({ message: 'Server error' });
  }
});

// C. GENERAL ALL DOCUMENTS ROUTE (Homepage)
// Find your router.get('/') route (around line 140 in the last code block) 
// and replace it with this version:

// --- GET ALL DOCUMENTS (Public/Homepage) - WITH SEARCH AND FILTER ---
router.get('/', async (req, res) => {
  try {
    const { q, category } = req.query; // Get search term (q) and category from the URL query

    let query = {}; // Initialize the MongoDB query object

    // 1. Add Search Term to Query
    if (q) {
      // Use $or to search title OR description for the term (case-insensitive)
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    // 2. Add Category Filter to Query
    if (category && category !== 'All') {
      query.category = category;
    }

    // Execute the modified query
    const documents = await Document.find(query)
      .populate('creator', 'name')
      .sort({ createdAt: -1 });

    res.json(documents);
  } catch (error) {
    console.error('Error fetching all documents:', error);
    res.status(500).json({ message: 'Server error fetching documents' });
  }
});

module.exports = router;