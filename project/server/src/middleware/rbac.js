const { ForbiddenError } = require('../utils/errors');
const ROLES = { 
  admin: ['analyze','upload','reports:read','reports:delete','users:manage'],
  analyst: ['analyze','upload','reports:read'], 
  viewer: ['reports:read'] 
};

function rbac(permission) {
  return (req, res, next) => {
    const perms = ROLES[req.user?.role] || [];
    if (!perms.includes(permission)) {
      throw new ForbiddenError(`Missing permission: ${permission}`);
    }
    next();
  };
}
module.exports = rbac;
