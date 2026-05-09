import logger from '../utils/logger.js';

// Middleware qui logue chaque requête HTTP
export const httpLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const meta = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.headers['x-forwarded-for'],
    };

    if (res.statusCode >= 500) {
      logger.error('HTTP Request', meta);
    } else if (res.statusCode >= 400) {
      logger.warn('HTTP Request', meta);
    } else {
      logger.http('HTTP Request', meta);
    }
  });

  next();
};
