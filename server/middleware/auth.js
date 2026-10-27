const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;

  // Check for the authorization header
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Please log in to continue.",
    });
  }

  // Extract the token
  const token = authorization.slice(7);

  try {
    // Verify the JWT token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Check whether the token contains a user ID
    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    // Store the authenticated user's ID
    req.userId = decoded.userId;

    // Continue to the requested route
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Your session is invalid or expired. Please log in again.",
    });
  }
}

module.exports = requireAuth;