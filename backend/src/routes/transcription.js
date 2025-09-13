const express = require('express');
const router = express.Router();
const TranscriptionService = require('../services/transcriptionService');

/**
 * GET /api/transcription/status
 * Get current transcription service status
 */
router.get('/status', (req, res) => {
  try {
    const status = TranscriptionService.getProviderStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting transcription status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transcription status'
    });
  }
});

/**
 * POST /api/transcription/provider
 * Switch transcription provider
 */
router.post('/provider', (req, res) => {
  try {
    const { provider } = req.body;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Provider is required'
      });
    }
    
    TranscriptionService.switchProvider(provider);
    
    res.json({
      success: true,
      message: `Switched to ${provider} provider`,
      data: TranscriptionService.getProviderStatus()
    });
    
  } catch (error) {
    console.error('Error switching provider:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/transcription/test
 * Test transcription with sample audio
 */
router.post('/test', async (req, res) => {
  try {
    const { audioData, provider } = req.body;
    
    if (!audioData) {
      return res.status(400).json({
        success: false,
        error: 'Audio data is required for testing'
      });
    }
    
    // Switch provider temporarily if specified
    const originalProvider = TranscriptionService.activeProvider;
    if (provider) {
      TranscriptionService.switchProvider(provider);
    }
    
    // Convert base64 audio data to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // Process test transcription
    const result = await TranscriptionService.processAudioChunk(audioBuffer, {
      speaker: 'test',
      sessionId: 'test-session',
      timestamp: new Date()
    });
    
    // Restore original provider
    if (provider) {
      TranscriptionService.switchProvider(originalProvider);
    }
    
    res.json({
      success: true,
      data: result,
      message: 'Test transcription completed'
    });
    
  } catch (error) {
    console.error('Error testing transcription:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Transcription test failed'
    });
  }
});

/**
 * DELETE /api/transcription/session/:sessionId
 * Clean up transcription session
 */
router.delete('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    TranscriptionService.cleanupSession(sessionId);
    
    res.json({
      success: true,
      message: `Session ${sessionId} cleaned up`
    });
    
  } catch (error) {
    console.error('Error cleaning up session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean up session'
    });
  }
});

/**
 * GET /api/transcription/providers
 * Get available transcription providers
 */
router.get('/providers', (req, res) => {
  try {
    const providers = [
      {
        name: 'openai',
        displayName: 'OpenAI Whisper',
        features: ['High accuracy', 'Multiple languages', 'Word timestamps'],
        available: !!process.env.OPENAI_API_KEY
      },
      {
        name: 'deepgram',
        displayName: 'Deepgram',
        features: ['Real-time', 'Speaker diarization', 'Fast processing'],
        available: !!process.env.DEEPGRAM_API_KEY
      },
      {
        name: 'assemblyai',
        displayName: 'AssemblyAI',
        features: ['Speaker labels', 'Punctuation', 'High accuracy'],
        available: !!process.env.ASSEMBLYAI_API_KEY
      }
    ];
    
    res.json({
      success: true,
      data: providers
    });
    
  } catch (error) {
    console.error('Error getting providers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get providers'
    });
  }
});

module.exports = router;
