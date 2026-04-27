// Simple in-memory rate limiter to fulfill roadmap Flow 8
const limitData = new Map();

function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 60000;
    const limit = 100;
    
    if (!limitData.has(ip)) {
      limitData.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const data = limitData.get(ip);
    if (now > data.resetTime) {
      data.count = 1;
      data.resetTime = now + windowMs;
      return next();
    }
    
    data.count++;
    if (data.count > limit) {
      return res.status(429).json({ error: true, message: 'Too many requests' });
    }
    
    next();
}

module.exports = rateLimiter;
