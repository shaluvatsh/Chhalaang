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

      // Check if we should use mock mode
      if (MockAIService.shouldUseMockMode()) {
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
      
      // Process when we have enough audio or enough time has passed
      const shouldProcess = 
        sessionBuffer.totalSize >= config.transcription.maxAudioChunkSize ||
        (Date.now() - sessionBuffer.lastProcessed) >= config.transcription.interval;
      
      if (shouldProcess) {
        const result = await this.transcribeBufferedAudio(sessionId);
        
        // Reset buffer
        sessionBuffer.chunks = [];
        sessionBuffer.lastProcessed = Date.now();
        sessionBuffer.totalSize = 0;
        
        return result;
      }
      
      return null; // Not ready to process yet
      
    } catch (error) {
      console.error('Error processing audio chunk:', error);
      throw error;
    }
  }
  
  /**
   * Transcribe buffered audio chunks
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
    
    // Choose transcription provider
    switch (this.activeProvider) {
      case 'openai':
        return await this.transcribeWithOpenAI(combinedAudio, { speaker: latestSpeaker });
      case 'deepgram':
        return await this.transcribeWithDeepgram(combinedAudio, { speaker: latestSpeaker });
      case 'assemblyai':
        return await this.transcribeWithAssemblyAI(combinedAudio, { speaker: latestSpeaker });
      default:
        throw new Error(`Unsupported transcription provider: ${this.activeProvider}`);
    }
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
      
      // Convert buffer to file-like object for OpenAI API
      const audioFile = new File([audioBuffer], 'audio.wav', { type: 'audio/wav' });
      
      const response = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en',
        response_format: 'verbose_json',
        timestamp_granularities: ['word']
      });
      
      return {
        text: response.text.trim(),
        confidence: 0.9, // OpenAI doesn't provide confidence scores
        speaker: options.speaker,
        provider: 'openai',
        words: response.words || [],
        language: response.language
      };
      
    } catch (error) {
      console.error('OpenAI transcription error:', error);
      throw new Error(`OpenAI transcription failed: ${error.message}`);
    }
  }
  
  /**
   * Transcribe using Deepgram
   * @param {Buffer} audioBuffer - Audio data
   * @param {Object} options - Options
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeWithDeepgram(audioBuffer, options = {}) {
    try {
      if (!config.deepgram.apiKey) {
        throw new Error('Deepgram API key not configured');
      }
      
      const response = await axios.post(
        'https://api.deepgram.com/v1/listen',
        audioBuffer,
        {
          headers: {
            'Authorization': `Token ${config.deepgram.apiKey}`,
            'Content-Type': 'audio/wav'
          },
          params: {
            model: 'nova-2',
            language: 'en-US',
            punctuate: true,
            diarize: true,
            smart_format: true,
            utterances: true
          }
        }
      );
      
      const result = response.data.results;
      const transcript = result.channels[0].alternatives[0];
      
      return {
        text: transcript.transcript.trim(),
        confidence: transcript.confidence,
        speaker: options.speaker,
        provider: 'deepgram',
        words: transcript.words || [],
        utterances: result.utterances || []
      };
      
    } catch (error) {
      console.error('Deepgram transcription error:', error);
      throw new Error(`Deepgram transcription failed: ${error.message}`);
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
    const supportedProviders = ['openai', 'deepgram', 'assemblyai'];
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
        deepgram: !!config.deepgram.apiKey,
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
