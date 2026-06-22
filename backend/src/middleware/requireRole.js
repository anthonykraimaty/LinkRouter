// Role-based authorization middleware. Must run AFTER authMiddleware,
// which populates req.user (with the `role` claim from the JWT).
//
// Usage:
//   router.use(authMiddleware, requireRole('admin'));
//   router.get('/x', requireRole('admin', 'link_manager'), handler);
function requireRole(...allowedRoles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }
    next();
  };
}

module.exports = requireRole;
