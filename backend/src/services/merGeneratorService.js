const OpenAI = require('openai');
const config = require('../config/config');
const MockAIService = require('./mockAIService');

class MERGeneratorService {
  constructor() {
    if (config.openai.apiKey) {
      this.openai = new OpenAI({
        apiKey: config.openai.apiKey
      });
    }
  }
  
  /**
   * Generate Medical Encounter Record from transcript
   * @param {Object} data - Session data with transcript
   * @returns {Promise<Object>} Generated MER document
   */
  async generateMER(data) {
    try {
      const { transcript, doctor, patient, sessionId, customInstructions } = data;
      
      if (!transcript || transcript.length === 0) {
        throw new Error('No transcript available for MER generation');
      }

      // Check if we should use mock mode
      if (MockAIService.shouldUseMockOpenAI()) {
        console.log('🎭 Using Mock AI Service for MER generation');
        return await MockAIService.generateMockMER(transcript);
      }
      
      // Prepare the transcript text
      const transcriptText = this.formatTranscriptForAnalysis(transcript);
      
      // Generate different sections of MER
      const [soapNotes, icdCodes, prescriptions, summary] = await Promise.all([
        this.generateSOAPNotes(transcriptText, { doctor, patient }),
        this.generateICDCodes(transcriptText),
        this.generatePrescriptions(transcriptText),
        this.generateSummary(transcriptText, { doctor, patient })
      ]);
      
      // Compile the complete MER document
      const merDocument = {
        metadata: {
          sessionId,
          doctor,
          patient,
          generatedAt: new Date(),
          transcript: transcript
        },
        summary,
        soapNotes,
        icdCodes,
        prescriptions,
        customInstructions
      };
      
      console.log(`📋 Generated MER for session ${sessionId}`);
      return merDocument;
      
    } catch (error) {
      console.error('Error generating MER:', error);
      throw error;
    }
  }
  
  /**
   * Format transcript for LLM analysis
   * @param {Array} transcript - Raw transcript entries
   * @returns {string} Formatted transcript text
   */
  formatTranscriptForAnalysis(transcript) {
    return transcript
      .map(entry => `[${entry.speaker}] ${entry.text}`)
      .join('\n');
  }
  
  /**
   * Generate SOAP notes from transcript
   * @param {string} transcriptText - Formatted transcript
   * @param {Object} participants - Doctor and patient info
   * @returns {Promise<Object>} SOAP notes structure
   */
  async generateSOAPNotes(transcriptText, participants) {
    const prompt = `
You are a medical AI assistant. Analyze the following doctor-patient consultation transcript and generate structured SOAP notes.

TRANSCRIPT:
${transcriptText}

PARTICIPANTS:
Doctor: ${participants.doctor}
Patient: ${participants.patient}

Please generate SOAP notes in the following JSON format:
{
  "subjective": {
    "chiefComplaint": "Patient's main concern or reason for visit",
    "historyOfPresentIllness": "Detailed description of current symptoms",
    "reviewOfSystems": "Relevant positive and negative findings",
    "pastMedicalHistory": "Previous conditions, surgeries, medications",
    "socialHistory": "Relevant lifestyle factors",
    "familyHistory": "Relevant family medical history"
  },
  "objective": {
    "vitalSigns": "Any mentioned vital signs or measurements",
    "physicalExam": "Physical examination findings mentioned",
    "labResults": "Any lab or diagnostic results discussed",
    "imaging": "Imaging results if mentioned"
  },
  "assessment": {
    "primaryDiagnosis": "Most likely diagnosis based on findings",
    "differentialDiagnoses": ["Alternative diagnoses to consider"],
    "clinicalImpression": "Doctor's overall assessment"
  },
  "plan": {
    "medications": ["Prescribed medications with dosages"],
    "procedures": ["Recommended procedures or tests"],
    "followUp": "Follow-up instructions",
    "patientEducation": "Education provided to patient",
    "referrals": ["Referrals to specialists if mentioned"]
  }
}

Focus on extracting only information that was actually discussed in the consultation. Mark fields as "Not discussed" if not mentioned.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: config.openai.maxTokens,
        temperature: config.openai.temperature,
        response_format: { type: 'json_object' }
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error generating SOAP notes:', error);
      return {
        error: 'Failed to generate SOAP notes',
        subjective: { chiefComplaint: "Error in processing" },
        objective: { vitalSigns: "Not available" },
        assessment: { primaryDiagnosis: "Unable to determine" },
        plan: { medications: ["Review required"] }
      };
    }
  }
  
  /**
   * Generate ICD-10 codes from transcript
   * @param {string} transcriptText - Formatted transcript
   * @returns {Promise<Array>} Array of ICD-10 codes with descriptions
   */
  async generateICDCodes(transcriptText) {
    const prompt = `
You are a medical coding specialist. Analyze the following doctor-patient consultation transcript and suggest appropriate ICD-10 codes.

TRANSCRIPT:
${transcriptText}

Please provide ICD-10 codes in the following JSON format:
{
  "primary": {
    "code": "ICD-10 code",
    "description": "Description of the condition",
    "confidence": "high|medium|low"
  },
  "secondary": [
    {
      "code": "ICD-10 code",
      "description": "Description of the condition",
      "confidence": "high|medium|low"
    }
  ],
  "notes": "Any additional notes about the coding decisions"
}

Only suggest codes for conditions that are clearly mentioned or strongly implied in the consultation. Use standard ICD-10 codes and be conservative in your suggestions.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.1, // Lower temperature for more consistent coding
        response_format: { type: 'json_object' }
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error generating ICD codes:', error);
      return {
        primary: { code: "Z00.00", description: "Encounter for general adult medical examination without abnormal findings", confidence: "low" },
        secondary: [],
        notes: "Error in automated coding - manual review required"
      };
    }
  }
  
  /**
   * Generate prescription information from transcript
   * @param {string} transcriptText - Formatted transcript
   * @returns {Promise<Array>} Array of prescription details
   */
  async generatePrescriptions(transcriptText) {
    const prompt = `
You are a clinical pharmacist. Analyze the following doctor-patient consultation transcript and extract any medications prescribed or discussed.

TRANSCRIPT:
${transcriptText}

Please provide prescription information in the following JSON format:
{
  "prescribed": [
    {
      "medication": "Generic name (Brand name if mentioned)",
      "dosage": "Strength and form",
      "frequency": "How often to take",
      "duration": "How long to take",
      "instructions": "Special instructions",
      "indication": "What it's for"
    }
  ],
  "discontinued": [
    {
      "medication": "Name of discontinued medication",
      "reason": "Reason for discontinuation"
    }
  ],
  "allergies": ["Any mentioned drug allergies"],
  "interactions": ["Any potential interactions mentioned"],
  "notes": "Additional pharmacy notes"
}

Only include medications that were explicitly prescribed or discussed during this consultation. Do not add medications that might typically be used but weren't mentioned.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error generating prescriptions:', error);
      return {
        prescribed: [],
        discontinued: [],
        allergies: [],
        interactions: [],
        notes: "Error in prescription extraction - manual review required"
      };
    }
  }
  
  /**
   * Generate executive summary of the consultation
   * @param {string} transcriptText - Formatted transcript
   * @param {Object} participants - Doctor and patient info
   * @returns {Promise<Object>} Summary object
   */
  async generateSummary(transcriptText, participants) {
    const prompt = `
You are a medical documentation specialist. Create a concise executive summary of the following doctor-patient consultation.

TRANSCRIPT:
${transcriptText}

PARTICIPANTS:
Doctor: ${participants.doctor}
Patient: ${participants.patient}

Please provide a summary in the following JSON format:
{
  "executiveSummary": "2-3 sentence overview of the consultation",
  "keyFindings": ["List of 3-5 most important findings or topics discussed"],
  "actionItems": ["Specific next steps or follow-up actions"],
  "clinicalDecisionMaking": "Brief explanation of the doctor's clinical reasoning",
  "patientConcerns": ["Main concerns or questions raised by the patient"],
  "consultationOutcome": "Overall outcome and next steps"
}

Keep the summary professional, concise, and focused on the most clinically relevant information.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error generating summary:', error);
      return {
        executiveSummary: "Unable to generate summary due to processing error",
        keyFindings: ["Manual review required"],
        actionItems: ["Review transcript and generate summary manually"],
        clinicalDecisionMaking: "Not available",
        patientConcerns: ["Not processed"],
        consultationOutcome: "Requires manual documentation"
      };
    }
  }
  
  /**
   * Generate a quick note during consultation
   * @param {string} transcriptSegment - Recent transcript segment
   * @returns {Promise<string>} Quick clinical note
   */
  async generateQuickNote(transcriptSegment) {
    const prompt = `
Based on this recent conversation segment from a doctor-patient consultation, generate a brief clinical note (1-2 sentences):

RECENT CONVERSATION:
${transcriptSegment}

Provide a concise clinical note that captures the key medical information discussed.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.3
      });
      
      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating quick note:', error);
      return "Unable to generate note - manual entry required";
    }
  }
  
  /**
   * Validate and refine generated MER
   * @param {Object} merDocument - Generated MER document
   * @returns {Promise<Object>} Validated and refined MER
   */
  async validateAndRefineMER(merDocument) {
    // Add validation logic here
    // For hackathon, we'll do basic validation
    
    const validatedMER = {
      ...merDocument,
      validationStatus: {
        isValid: true,
        warnings: [],
        suggestions: [],
        validatedAt: new Date()
      }
    };
    
    // Basic validation checks
    if (!merDocument.soapNotes?.subjective?.chiefComplaint) {
      validatedMER.validationStatus.warnings.push("Chief complaint not clearly identified");
    }
    
    if (!merDocument.icdCodes?.primary?.code) {
      validatedMER.validationStatus.warnings.push("No primary diagnosis code identified");
    }
    
    if (validatedMER.validationStatus.warnings.length > 0) {
      validatedMER.validationStatus.isValid = false;
    }
    
    return validatedMER;
  }
}

module.exports = new MERGeneratorService();
