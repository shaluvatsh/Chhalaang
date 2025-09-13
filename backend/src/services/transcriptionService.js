const OpenAI = require('openai');
const axios = require('axios');
const config = require('../config/config');
const MockAIService = require('./mockAIService');

class TranscriptionService {
  constructor() {
    // Initialize OpenAI client
    if (config.openai.apiKey) {
      this.openai = new OpenAI({
        apiKey: config.openai.apiKey
      });
    }
    
    this.activeProvider = config.transcription.provider;
    this.audioBuffer = new Map(); // Store audio chunks per session
    
    console.log(`🎤 TranscriptionService initialized with provider: ${this.activeProvider}`);
    
    // Start periodic processing check to handle stuck buffers
    this.startPeriodicProcessing();
  }
  
  /**
   * Start periodic processing to handle stuck audio buffers
   */
  startPeriodicProcessing() {
    setInterval(async () => {
      for (const [sessionId, buffer] of this.audioBuffer.entries()) {
        // Process buffers that have been waiting too long (more than 8 seconds)
        if (buffer.chunks.length > 0 && 
            (Date.now() - buffer.lastProcessed) > 8000) {
          console.log(`🔔 Periodic processing for session ${sessionId} - ${buffer.chunks.length} chunks waiting`);
          try {
            const result = await this.transcribeBufferedAudio(sessionId);
            if (result) {
              console.log('📢 Periodic transcription result:', result.text);
            }
            
            // Reset buffer
            buffer.chunks = [];
            buffer.lastProcessed = Date.now();
            buffer.totalSize = 0;
          } catch (error) {
            console.error('❌ Error in periodic processing:', error);
          }
        }
      }
    }, 4000); // Check every 4 seconds
  }
  
  /**
   * Process audio chunk and return transcription
   * @param {Buffer} audioChunk - Raw audio data
   * @param {Object} options - Session and speaker info
   * @returns {Promise<Object>} Transcription result
   */
  async processAudioChunk(audioChunk, options = {}) {
    try {
      const { speaker, sessionId, timestamp } = options;

      // Check if we should use mock mode for transcription specifically
      if (MockAIService.shouldUseMockTranscription()) {
        console.log('🎭 Using Mock AI Service for transcription');
        return await MockAIService.generateMockTranscription(audioChunk, { speaker, sessionId });
      }
      
      // Buffer audio chunks to reduce API calls
      if (!this.audioBuffer.has(sessionId)) {
        this.audioBuffer.set(sessionId, {
          chunks: [],
          lastProcessed: Date.now(),
          totalSize: 0
        });
      }
      
      const sessionBuffer = this.audioBuffer.get(sessionId);
      sessionBuffer.chunks.push({
        data: audioChunk,
        timestamp,
        speaker
      });
      sessionBuffer.totalSize += audioChunk.length;
      
      console.log(`🎵 Session ${sessionId} buffer status:`, {
        chunks: sessionBuffer.chunks.length,
        totalSize: sessionBuffer.totalSize,
        maxSize: config.transcription.maxAudioChunkSize,
        timeSinceLastProcess: Date.now() - sessionBuffer.lastProcessed,
        interval: config.transcription.interval
      });
      
      // Process when we have enough audio or enough time has passed
      const shouldProcess = 
        sessionBuffer.totalSize >= config.transcription.maxAudioChunkSize ||
        (Date.now() - sessionBuffer.lastProcessed) >= config.transcription.interval ||
        sessionBuffer.chunks.length >= 3; // Also process after 3 chunks (9 seconds of audio)
      
      if (shouldProcess) {
        console.log(`✅ Processing audio for session ${sessionId}: ${sessionBuffer.chunks.length} chunks, ${sessionBuffer.totalSize} bytes`);
        
        const result = await this.transcribeBufferedAudio(sessionId);
        
        // Reset buffer
        sessionBuffer.chunks = [];
        sessionBuffer.lastProcessed = Date.now();
        sessionBuffer.totalSize = 0;
        
        return result;
      } else {
        console.log(`⏳ Not ready to process yet for session ${sessionId}`);
      }
      
      return null; // Not ready to process yet
      
    } catch (error) {
      console.error('Error processing audio chunk:', error);
      throw error;
    }
  }
  
  /**
   * Transcribe buffered audio chunks with fallback providers
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeBufferedAudio(sessionId) {
    const sessionBuffer = this.audioBuffer.get(sessionId);
    if (!sessionBuffer || sessionBuffer.chunks.length === 0) {
      return null;
    }
    
    // Combine audio chunks
    const combinedAudio = Buffer.concat(sessionBuffer.chunks.map(chunk => chunk.data));
    const latestSpeaker = sessionBuffer.chunks[sessionBuffer.chunks.length - 1].speaker;
    
    // Check if we should use mock transcription first
    if (mockAIService.shouldUseMockTranscription()) {
      console.log('🎭 Using Mock transcription service');
      return await mockAIService.generateMockTranscription(combinedAudio, { speaker: latestSpeaker });
    }
    
    // Try providers in order with fallback
    const providers = [this.activeProvider];
    
    // Add fallback providers
    if (this.activeProvider === 'elevenlabs') {
      providers.push('openai'); // Fallback to OpenAI Whisper if ElevenLabs fails
    } else if (this.activeProvider === 'openai') {
      providers.push('elevenlabs'); // Fallback to ElevenLabs if OpenAI fails
    }
    
    let lastError;
    
    for (const provider of providers) {
      try {
        console.log(`🎯 Trying transcription with ${provider}`);
        
        switch (provider) {
          case 'openai':
            // Check if OpenAI key is configured
            if (!config.openai.apiKey || config.openai.apiKey.includes('PASTE_YOUR_ACTUAL_OPENAI_API_KEY_HERE')) {
              console.log('🎭 OpenAI key not configured, using Mock transcription');
              return await mockAIService.generateMockTranscription(combinedAudio, { speaker: latestSpeaker });
            }
            return await this.transcribeWithOpenAI(combinedAudio, { speaker: latestSpeaker });
            
          case 'elevenlabs':
            return await this.transcribeWithElevenLabs(combinedAudio, { speaker: latestSpeaker });
            
          case 'assemblyai':
            return await this.transcribeWithAssemblyAI(combinedAudio, { speaker: latestSpeaker });
            
          default:
            throw new Error(`Unsupported transcription provider: ${provider}`);
        }
        
      } catch (error) {
        console.error(`❌ ${provider} transcription failed:`, error.message);
        lastError = error;
        
        // If this is the last provider, fall back to mock
        if (provider === providers[providers.length - 1]) {
          console.log('🎭 All providers failed, falling back to Mock transcription');
          return await mockAIService.generateMockTranscription(combinedAudio, { speaker: latestSpeaker });
        }
        
        continue; // Try next provider
      }
    }
    
    // If we somehow get here, use mock as final fallback
    console.log('🎭 Using Mock transcription as final fallback');
    return await mockAIService.generateMockTranscription(combinedAudio, { speaker: latestSpeaker });
  }
  
  /**
   * Transcribe using OpenAI Whisper
   * @param {Buffer} audioBuffer - Audio data
   * @param {Object} options - Options
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeWithOpenAI(audioBuffer, options = {}) {
    try {
      if (!this.openai) {
        throw new Error('OpenAI API key not configured');
      }
      
      console.log('🔊 OpenAI Whisper transcription request - Audio size:', audioBuffer.length, 'bytes');
      
      // Create FormData for OpenAI API
      const FormData = require('form-data');
      const form = new FormData();
      
      // Add audio file to form - OpenAI expects 'file' field
      form.append('file', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      
      // Add parameters
      form.append('model', 'whisper-1');
      form.append('language', 'en');
      form.append('response_format', 'verbose_json');
      
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        form,
        {
          headers: {
            'Authorization': `Bearer ${config.openai.apiKey}`,
            ...form.getHeaders()
          },
          timeout: 30000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      );
      
      console.log('✅ OpenAI Whisper response received:', response.status);
      const result = response.data;
      
      return {
        text: result.text?.trim() || '',
        confidence: 0.9, // OpenAI doesn't provide confidence scores
        speaker: options.speaker,
        provider: 'openai',
        language: result.language || 'en',
        words: result.words || [],
        segments: result.segments || []
      };
      
    } catch (error) {
      console.error('OpenAI Whisper transcription error:', error);
      
      // Log response details for debugging
      if (error.response) {
        console.error('OpenAI API Error Details:');
        console.error('Status:', error.response.status);
        console.error('Headers:', error.response.headers);
        console.error('Data:', error.response.data);
      }
      
      if (error.response?.status === 401) {
        throw new Error('Invalid OpenAI API key');
      } else if (error.response?.status === 429) {
        throw new Error('OpenAI rate limit exceeded');
      } else if (error.response?.status === 400) {
        throw new Error('OpenAI bad request - check audio format or parameters');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('OpenAI request timeout');
      }
      
      throw new Error(`OpenAI transcription failed: ${error.message}`);
    }
  }
  
  /**
   * Transcribe using ElevenLabs Speech-to-Text
   * @param {Buffer} audioBuffer - Audio data
   * @param {Object} options - Options
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeWithElevenLabs(audioBuffer, options = {}) {
    try {
      if (!config.elevenlabs.apiKey) {
        throw new Error('ElevenLabs API key not configured');
      }
      
      console.log('🔊 ElevenLabs transcription request - Audio size:', audioBuffer.length, 'bytes');
      
      // Create FormData for multipart/form-data request
      const FormData = require('form-data');
      const form = new FormData();
      
      // Add audio file to form - ElevenLabs expects 'file' field (not 'audio')
      form.append('file', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      
      // ElevenLabs specific parameters - use model from config
      form.append('model_id', config.elevenlabs.modelId || 'scribe_v1'); // Use configured model ID
      
      const response = await axios.post(
        'https://api.elevenlabs.io/v1/speech-to-text',
        form,
        {
          headers: {
            'xi-api-key': config.elevenlabs.apiKey,
            ...form.getHeaders()
          },
          timeout: 30000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      );
      
      console.log('✅ ElevenLabs response received:', response.status);
      const result = response.data;
      
      // ElevenLabs returns different format, adapt to our standard
      return {
        text: result.text?.trim() || '',
        confidence: result.confidence || 0.9,
        speaker: options.speaker,
        provider: 'elevenlabs',
        language: result.detected_language || 'en',
        segments: result.segments || [],
        speakers: result.speakers || []
      };
      
    } catch (error) {
      console.error('ElevenLabs transcription error:', error);
      
      // Log response details for debugging
      if (error.response) {
        console.error('ElevenLabs API Error Details:');
        console.error('Status:', error.response.status);
        console.error('Headers:', error.response.headers);
        console.error('Data:', error.response.data);
      }
      
      if (error.response?.status === 401) {
        throw new Error('Invalid ElevenLabs API key');
      } else if (error.response?.status === 429) {
        throw new Error('ElevenLabs rate limit exceeded');
      } else if (error.response?.status === 400) {
        throw new Error('ElevenLabs bad request - check audio format or parameters');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('ElevenLabs request timeout');
      }
      
      throw new Error(`ElevenLabs transcription failed: ${error.message}`);
    }
  }
  
  /**
   * Transcribe using AssemblyAI
   * @param {Buffer} audioBuffer - Audio data
   * @param {Object} options - Options
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeWithAssemblyAI(audioBuffer, options = {}) {
    try {
      if (!config.assemblyai.apiKey) {
        throw new Error('AssemblyAI API key not configured');
      }
      
      // Upload audio file first
      const uploadResponse = await axios.post(
        'https://api.assemblyai.com/v2/upload',
        audioBuffer,
        {
          headers: {
            'Authorization': config.assemblyai.apiKey,
            'Content-Type': 'application/octet-stream'
          }
        }
      );
      
      const audioUrl = uploadResponse.data.upload_url;
      
      // Create transcription job
      const transcriptResponse = await axios.post(
        'https://api.assemblyai.com/v2/transcript',
        {
          audio_url: audioUrl,
          speaker_labels: true,
          punctuate: true,
          format_text: true
        },
        {
          headers: {
            'Authorization': config.assemblyai.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const transcriptId = transcriptResponse.data.id;
      
      // Poll for completion (simplified for hackathon)
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        const statusResponse = await axios.get(
          `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
          {
            headers: {
              'Authorization': config.assemblyai.apiKey
            }
          }
        );
        
        if (statusResponse.data.status === 'completed') {
          return {
            text: statusResponse.data.text.trim(),
            confidence: statusResponse.data.confidence,
            speaker: options.speaker,
            provider: 'assemblyai',
            words: statusResponse.data.words || [],
            utterances: statusResponse.data.utterances || []
          };
        }
        
        if (statusResponse.data.status === 'error') {
          throw new Error('AssemblyAI transcription failed');
        }
        
        // Wait 1 second before next poll
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      throw new Error('AssemblyAI transcription timeout');
      
    } catch (error) {
      console.error('AssemblyAI transcription error:', error);
      throw new Error(`AssemblyAI transcription failed: ${error.message}`);
    }
  }
  
  /**
   * Switch transcription provider
   * @param {string} provider - Provider name
   */
  switchProvider(provider) {
    const supportedProviders = ['openai', 'elevenlabs', 'assemblyai'];
    if (!supportedProviders.includes(provider)) {
      throw new Error(`Unsupported provider: ${provider}. Supported: ${supportedProviders.join(', ')}`);
    }
    
    this.activeProvider = provider;
    console.log(`🔄 Switched transcription provider to: ${provider}`);
  }
  
  /**
   * Get provider status
   * @returns {Object} Provider status information
   */
  getProviderStatus() {
    return {
      activeProvider: this.activeProvider,
      available: {
        openai: !!config.openai.apiKey,
        elevenlabs: !!config.elevenlabs.apiKey,
        assemblyai: !!config.assemblyai.apiKey
      },
      settings: {
        interval: config.transcription.interval,
        maxChunkSize: config.transcription.maxAudioChunkSize
      }
    };
  }
  
  /**
   * Clean up audio buffer for a session
   * @param {string} sessionId - Session to clean up
   */
  cleanupSession(sessionId) {
    if (this.audioBuffer.has(sessionId)) {
      this.audioBuffer.delete(sessionId);
      console.log(`🗑️ Cleaned up audio buffer for session: ${sessionId}`);
    }
  }
}

module.exports = new TranscriptionService();
