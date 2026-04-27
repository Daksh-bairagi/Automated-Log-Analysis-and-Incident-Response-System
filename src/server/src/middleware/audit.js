function auditMiddleware(auditRepo) {
  return (req, res, next) => {
    const start = Date.now();
    const origJson = res.json.bind(res);
    res.json = (body) => {
      // Only log if auditRepo exists and has log method
      if (auditRepo && auditRepo.log) {
        auditRepo.log({ 
          action: `${req.method} ${req.path}`, 
          userId: req.user?.id || 'anon',
          details: { status: res.statusCode, durationMs: Date.now()-start }, 
          timestamp: new Date() 
        }).catch(err => console.error('Audit Log failed:', err));
      }
      return origJson(body);
    };
    next();
  };
}
module.exports = auditMiddleware;
