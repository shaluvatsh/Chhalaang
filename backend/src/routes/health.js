const express = require('express');
const router = express.Router();
const config = require('../config/config');

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/', (req, res) => {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'AI Voice MER Backend',
      version: '1.0.0',
      uptime: process.uptime(),
      environment: config.nodeEnv,
      memory: process.memoryUsage(),
      services: {
        transcription: {
          provider: config.transcription.provider,
          available: {
            openai: !!config.openai.apiKey,
            deepgram: !!config.deepgram.apiKey,
            assemblyai: !!config.assemblyai.apiKey
          }
        },
        llm: {
          model: config.openai.model,
          available: !!config.openai.apiKey
        },
        database: {
          configured: !!(config.database.host && config.database.database)
        }
      }
    };
    
    res.status(200).json({
      success: true,
      data: healthData
    });
    
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/detailed
 * Detailed health check with service connectivity tests
 */
router.get('/detailed', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test OpenAI connectivity
    let openaiStatus = 'unavailable';
    if (config.openai.apiKey) {
      try {
        const openai = new (require('openai'))({ apiKey: config.openai.apiKey });
        await openai.models.list();
        openaiStatus = 'connected';
      } catch (error) {
        openaiStatus = 'error';
        console.warn('OpenAI connectivity test failed:', error.message);
      }
    }
    
    // Test Deepgram connectivity
    let deepgramStatus = 'unavailable';
    if (config.deepgram.apiKey) {
      try {
        await require('axios').get('https://api.deepgram.com/v1/projects', {
          headers: { 'Authorization': `Token ${config.deepgram.apiKey}` },
          timeout: 5000
        });
        deepgramStatus = 'connected';
      } catch (error) {
        deepgramStatus = 'error';
        console.warn('Deepgram connectivity test failed:', error.message);
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      service: {
        name: 'AI Voice MER Backend',
        version: '1.0.0',
        uptime: process.uptime(),
        environment: config.nodeEnv
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      services: {
        openai: {
          status: openaiStatus,
          model: config.openai.model
        },
        deepgram: {
          status: deepgramStatus,
          model: config.deepgram.model
        },
        assemblyai: {
          status: config.assemblyai.apiKey ? 'configured' : 'unavailable'
        }
      },
      configuration: {
        transcriptionProvider: config.transcription.provider,
        maxTokens: config.openai.maxTokens,
        temperature: config.openai.temperature,
        corsOrigins: config.corsOrigins?.length || 0
      }
    };
    
    res.status(200).json({
      success: true,
      data: detailedHealth
    });
    
  } catch (error) {
    console.error('Detailed health check error:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
