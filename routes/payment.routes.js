const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto'); // <-- 1. NEW IMPORT
const authMiddleware = require('../middleware/auth.middleware.js');
const Purchase = require('../models/purchase.model.js'); // <-- 2. NEW IMPORT
const Document = require('../models/document.model.js');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --- 1. CREATE ORDER ---
router.post('/create-order', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const options = {
      amount: amount * 100,
      currency: 'INR',
      receipt: 'receipt_' + Date.now(),
    };
    const order = await razorpay.orders.create(options);

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    res.status(500).json({ message: 'Payment initialization failed' });
  }
});

// --- 2. VERIFY PAYMENT (NEW ROUTE) ---
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    // These come from the frontend after Razorpay succeeds
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      documentId, 
      amount 
    } = req.body;

    // A. Verify Signature (Security Check)
    // We create the expected signature using our Secret Key
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    // B. Compare signatures
    if (razorpay_signature === expectedSign) {
      
      // C. Signature matches! Payment is real. Save to Database.
      const newPurchase = new Purchase({
        user: req.user.id,
        document: documentId,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        amount: amount,
        status: 'completed'
      });

      await newPurchase.save();

      res.json({ message: 'Payment verified and Purchase saved!' });
    } else {
      res.status(400).json({ message: 'Invalid signature sent!' });
    }

  } catch (error) {
    console.error('Verification Error:', error);
    // If it's a duplicate error (code 11000), it means they already bought it
    if(error.code === 11000) {
      return res.status(200).json({ message: 'You already own this document.' });
    }
    res.status(500).json({ message: 'Payment verification failed' });
  }
});
// --- 3. CHECK OWNERSHIP (NEW ROUTE) ---
router.get('/check/:documentId', authMiddleware, async (req, res) => {
  try {
    // Check if a completed purchase exists for this user + this document
    const purchase = await Purchase.findOne({
      user: req.user.id,
      document: req.params.documentId,
      status: 'completed'
    });

    if (purchase) {
      return res.json({ owned: true });
    } else {
      return res.json({ owned: false });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error checking ownership' });
  }
});
// --- 4. GET CREATOR STATS (NEW ROUTE) ---
router.get('/creator-stats', authMiddleware, async (req, res) => {
  try {
    // A. Find all documents created by this user
    const docs = await Document.find({ creator: req.user.id });
    
    if (docs.length === 0) {
      return res.json({ totalEarnings: 0, totalSales: 0, sales: [] });
    }

    // Get just the IDs of those documents
    const docIds = docs.map(doc => doc._id);

    // B. Find all completed purchases for these documents
    const purchases = await Purchase.find({
      document: { $in: docIds },
      status: 'completed'
    })
    .populate('document', 'title') // Get the document title
    .populate('user', 'name email') // Get the buyer's name
    .sort({ createdAt: -1 }); // Newest first

    // C. Calculate Totals
    const totalSales = purchases.length;
    const totalEarnings = purchases.reduce((sum, purchase) => sum + purchase.amount, 0);

    res.json({
      totalEarnings,
      totalSales,
      sales: purchases // Send the list of actual sales history
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

module.exports = router;