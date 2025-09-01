// middleware/auth.js
module.exports = function authenticateUser(req, res, next) {
  const userIdHeader = req.header('x-user-id') || null;

  if (!userIdHeader) {
    return res.status(401).json({ error: 'Unauthorized: missing x-user-id header' });
  }

  req.user = { id: userIdHeader };

  next();
};
