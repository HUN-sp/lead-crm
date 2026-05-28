const express = require('express');
const leadRoutes = require('./routes/leadRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Parse JSON request bodies
app.use(express.json());

// Health check — useful for Docker/k8s
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// All lead endpoints
app.use('/leads', leadRoutes);

// Catch-all for unknown routes
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
