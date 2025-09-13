const express = require('express');
const router = express.Router();
const MERGeneratorService = require('../services/merGeneratorService');

/**
 * POST /api/mer/generate
 * Generate MER from transcript data
 */
router.post('/generate', async (req, res) => {
  try {
    const { transcript, doctor, patient, sessionId, customInstructions } = req.body;
    
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid transcript array is required'
      });
    }
    
    if (!doctor || !patient) {
      return res.status(400).json({
        success: false,
        error: 'Doctor and patient information is required'
      });
    }
    
    const merDocument = await MERGeneratorService.generateMER({
      transcript,
      doctor,
      patient,
      sessionId: sessionId || `session_${Date.now()}`,
      customInstructions
    });
    
    res.json({
      success: true,
      data: merDocument,
      message: 'MER document generated successfully'
    });
    
  } catch (error) {
    console.error('Error generating MER:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate MER document'
    });
  }
});

/**
 * POST /api/mer/quick-note
 * Generate a quick clinical note from transcript segment
 */
router.post('/quick-note', async (req, res) => {
  try {
    const { transcriptSegment } = req.body;
    
    if (!transcriptSegment || typeof transcriptSegment !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Transcript segment is required'
      });
    }
    
    const quickNote = await MERGeneratorService.generateQuickNote(transcriptSegment);
    
    res.json({
      success: true,
      data: { note: quickNote },
      message: 'Quick note generated successfully'
    });
    
  } catch (error) {
    console.error('Error generating quick note:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate quick note'
    });
  }
});

/**
 * POST /api/mer/soap
 * Generate SOAP notes only
 */
router.post('/soap', async (req, res) => {
  try {
    const { transcript, doctor, patient } = req.body;
    
    if (!transcript || !Array.isArray(transcript)) {
      return res.status(400).json({
        success: false,
        error: 'Valid transcript array is required'
      });
    }
    
    const transcriptText = transcript
      .map(entry => `[${entry.speaker}] ${entry.text}`)
      .join('\n');
    
    const soapNotes = await MERGeneratorService.generateSOAPNotes(transcriptText, {
      doctor: doctor || 'Doctor',
      patient: patient || 'Patient'
    });
    
    res.json({
      success: true,
      data: soapNotes,
      message: 'SOAP notes generated successfully'
    });
    
  } catch (error) {
    console.error('Error generating SOAP notes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate SOAP notes'
    });
  }
});

/**
 * POST /api/mer/icd-codes
 * Generate ICD-10 codes only
 */
router.post('/icd-codes', async (req, res) => {
  try {
    const { transcript } = req.body;
    
    if (!transcript || !Array.isArray(transcript)) {
      return res.status(400).json({
        success: false,
        error: 'Valid transcript array is required'
      });
    }
    
    const transcriptText = transcript
      .map(entry => `[${entry.speaker}] ${entry.text}`)
      .join('\n');
    
    const icdCodes = await MERGeneratorService.generateICDCodes(transcriptText);
    
    res.json({
      success: true,
      data: icdCodes,
      message: 'ICD-10 codes generated successfully'
    });
    
  } catch (error) {
    console.error('Error generating ICD codes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate ICD codes'
    });
  }
});

/**
 * POST /api/mer/prescriptions
 * Generate prescription information only
 */
router.post('/prescriptions', async (req, res) => {
  try {
    const { transcript } = req.body;
    
    if (!transcript || !Array.isArray(transcript)) {
      return res.status(400).json({
        success: false,
        error: 'Valid transcript array is required'
      });
    }
    
    const transcriptText = transcript
      .map(entry => `[${entry.speaker}] ${entry.text}`)
      .join('\n');
    
    const prescriptions = await MERGeneratorService.generatePrescriptions(transcriptText);
    
    res.json({
      success: true,
      data: prescriptions,
      message: 'Prescription information generated successfully'
    });
    
  } catch (error) {
    console.error('Error generating prescriptions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate prescription information'
    });
  }
});

/**
 * POST /api/mer/validate
 * Validate and refine generated MER
 */
router.post('/validate', async (req, res) => {
  try {
    const { merDocument } = req.body;
    
    if (!merDocument || typeof merDocument !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'MER document is required for validation'
      });
    }
    
    const validatedMER = await MERGeneratorService.validateAndRefineMER(merDocument);
    
    res.json({
      success: true,
      data: validatedMER,
      message: 'MER document validated successfully'
    });
    
  } catch (error) {
    console.error('Error validating MER:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate MER document'
    });
  }
});

/**
 * GET /api/mer/templates
 * Get available MER templates
 */
router.get('/templates', (req, res) => {
  try {
    const templates = {
      soapTemplate: {
        subjective: {
          chiefComplaint: "",
          historyOfPresentIllness: "",
          reviewOfSystems: "",
          pastMedicalHistory: "",
          socialHistory: "",
          familyHistory: ""
        },
        objective: {
          vitalSigns: "",
          physicalExam: "",
          labResults: "",
          imaging: ""
        },
        assessment: {
          primaryDiagnosis: "",
          differentialDiagnoses: [],
          clinicalImpression: ""
        },
        plan: {
          medications: [],
          procedures: [],
          followUp: "",
          patientEducation: "",
          referrals: []
        }
      },
      quickNoteTemplate: {
        date: "",
        time: "",
        provider: "",
        patient: "",
        chiefComplaint: "",
        assessment: "",
        plan: ""
      },
      prescriptionTemplate: {
        medication: "",
        dosage: "",
        frequency: "",
        duration: "",
        instructions: "",
        indication: ""
      }
    };
    
    res.json({
      success: true,
      data: templates,
      message: 'MER templates retrieved successfully'
    });
    
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get MER templates'
    });
  }
});

module.exports = router;
