const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  // 1. Get the token from the "Authorization" header
  // It's usually sent as: "Bearer YOUR_TOKEN_HERE"
  const authHeader = req.header('Authorization');
  
  if (!authHeader) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // 2. The header looks like "Bearer <token>", so we split it and get the token
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Token is not in the correct format' });
  }

  try {
    // 3. Verify the token using your secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. If valid, add the user's data to the request object
    // Now, any protected route will know *who* is making the request
    req.user = decoded.user;
    
    // 5. Call "next()" to proceed to the actual route
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
}

module.exports = authMiddleware;