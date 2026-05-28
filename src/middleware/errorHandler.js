/**
 * Express error handler middleware.
 * Catches anything passed to next(err) and returns a clean JSON response.
 * Must have 4 parameters — Express identifies error handlers this way.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message);

  // Prisma known request errors
  if (err.code?.startsWith('P')) {
    return res.status(400).json({ error: err.message });
  }

  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
