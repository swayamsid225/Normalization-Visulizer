// middleware/auth.js
// Simple development auth middleware.
// For production replace with proper JWT/OAuth verification.

module.exports = function authenticateUser(req, res, next) {
  // Accept either an x-user-id header (for local/dev usage) or a Bearer token (not implemented here)
  const userIdHeader = req.header('x-user-id') || null;

  if (!userIdHeader) {
    return res.status(401).json({ error: 'Unauthorized: missing x-user-id header' });
  }

  // In a real app you'd validate the token and fetch user info.
  // For now create a minimal user object to attach to req.
  req.user = { id: userIdHeader };

  next();
};
