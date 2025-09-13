module.exports = {
  // Server Configuration
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'mer_database',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    dialect: 'postgres',
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false
  },
  
  // API Keys Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.LLM_MODEL || 'gpt-4o',
    maxTokens: parseInt(process.env.MAX_TOKENS) || 4000,
    temperature: parseFloat(process.env.TEMPERATURE) || 0.3
  },
  
  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY,
    model: 'nova-2',
    language: 'en-US'
  },
  
  assemblyai: {
    apiKey: process.env.ASSEMBLYAI_API_KEY,
    language: 'en_us'
  },
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_secret_key_for_development_only',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  
  // Transcription Settings
  transcription: {
    provider: process.env.TRANSCRIPTION_PROVIDER || 'openai',
    interval: parseInt(process.env.TRANSCRIPTION_INTERVAL) || 3000,
    maxAudioChunkSize: parseInt(process.env.MAX_AUDIO_CHUNK_SIZE) || 1048576,
    supportedFormats: ['wav', 'mp3', 'flac', 'aac', 'ogg']
  },
  
  // WebSocket Settings
  websocket: {
    heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL) || 30000,
    maxConnections: parseInt(process.env.MAX_CONNECTIONS) || 100,
    timeout: 60000
  },
  
  // File Upload Settings
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    allowedMimeTypes: [
      'audio/wav', 'audio/mpeg', 'audio/flac', 
      'audio/aac', 'audio/ogg', 'audio/webm'
    ]
  },
  
  // Session Configuration
  session: {
    timeout: parseInt(process.env.SESSION_TIMEOUT) || 2 * 60 * 60 * 1000, // 2 hours
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 30 * 60 * 1000 // 30 minutes
  },
  
  // CORS Origins
  corsOrigins: process.env.CORS_ORIGINS ? 
    process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()) : 
    ['http://localhost:3000', 'http://127.0.0.1:3000'],
  
  // Medical Record Generation Settings
  mer: {
    autoGenerate: true,
    generateInterval: 60000, // Generate MER every minute during recording
    includeTimestamps: true,
    confidenceThreshold: 0.7
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined'
  }
};
