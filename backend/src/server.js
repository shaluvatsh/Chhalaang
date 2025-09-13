const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import configurations and services
const config = require('./config/config');
const transcriptionRoutes = require('./routes/transcription');
const merRoutes = require('./routes/mer');
const sessionRoutes = require('./routes/session');
const healthRoutes = require('./routes/health');
const socketHandlers = require('./services/socketHandlers');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      mediaSrc: ["'self'"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for real-time app
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// CORS configuration for WebRTC and Socket.IO
const corsOptions = {
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
};

app.use(cors(corsOptions));

// Socket.IO setup with enhanced CORS
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint (keep for backward compatibility)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'AI Voice MER Backend',
    version: '1.0.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/transcription', transcriptionRoutes);
app.use('/api/mer', merRoutes);
app.use('/api/session', sessionRoutes);

// WebSocket handlers
socketHandlers(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  
  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Something went wrong on our end'
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message,
      stack: err.stack
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
const PORT = config.port;
server.listen(PORT, () => {
  console.log('🚀 =================================');
  console.log('🏥 AI Voice MER Backend Started');
  console.log('🚀 =================================');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🔧 Environment: ${config.nodeEnv}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
  console.log(`� Socket.IO: Enabled`);
  console.log(`📡 Transcription: ${config.transcription.provider}`);
  console.log('🚀 =================================');
});

module.exports = { app, server, io };
