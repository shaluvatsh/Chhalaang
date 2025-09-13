/**
 * Demo/Mock service for testing without API costs
 * Simulates OpenAI responses for development and demos
 */

class MockAIService {
  /**
   * Mock MER generation
   */
  static generateMockMER(transcript) {
    // Simulate processing delay
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          metadata: {
            sessionId: 'demo-session',
            doctor: 'Dr. Demo',
            patient: 'Demo Patient',
            generatedAt: new Date(),
            transcript: transcript
          },
          summary: {
            executiveSummary: "Patient presented with chest pain lasting 3 days. Physical examination and history suggest possible gastroesophageal reflux. Prescribed proton pump inhibitor and scheduled follow-up.",
            keyFindings: [
              "Chest pain for 3 days",
              "No radiation to arms",
              "Worse after meals",
              "No shortness of breath",
              "Normal vital signs"
            ],
            actionItems: [
              "Start omeprazole 20mg daily",
              "Follow up in 2 weeks",
              "Return if symptoms worsen"
            ],
            clinicalDecisionMaking: "Based on symptoms pattern and physical exam, GERD is most likely diagnosis. Cardiac causes ruled out based on history and presentation.",
            patientConcerns: [
              "Worried about heart attack",
              "Impact on daily activities"
            ],
            consultationOutcome: "Patient reassured, started on medication, scheduled follow-up"
          },
          soapNotes: {
            subjective: {
              chiefComplaint: "Chest pain for 3 days",
              historyOfPresentIllness: "Patient reports burning chest pain that started 3 days ago, worse after meals, no radiation to arms or jaw. No associated shortness of breath or diaphoresis.",
              reviewOfSystems: "Negative for dyspnea, palpitations, nausea, vomiting. Positive for heartburn.",
              pastMedicalHistory: "No significant past medical history",
              socialHistory: "Non-smoker, occasional alcohol use",
              familyHistory: "No family history of cardiac disease"
            },
            objective: {
              vitalSigns: "BP: 120/80, HR: 72, RR: 16, Temp: 98.6°F",
              physicalExam: "Alert and oriented. Heart rate regular, no murmurs. Lungs clear bilaterally. Abdomen soft, mild epigastric tenderness.",
              labResults: "Not ordered",
              imaging: "Not performed"
            },
            assessment: {
              primaryDiagnosis: "Gastroesophageal reflux disease (GERD)",
              differentialDiagnoses: ["Cardiac chest pain", "Peptic ulcer disease", "Costochondritis"],
              clinicalImpression: "Most consistent with GERD based on symptom pattern and physical findings"
            },
            plan: {
              medications: ["Omeprazole 20mg daily before breakfast"],
              procedures: ["None at this time"],
              followUp: "Return in 2 weeks or sooner if symptoms worsen",
              patientEducation: "Discussed dietary modifications, avoid spicy foods, elevate head of bed",
              referrals: ["GI referral if no improvement in 4 weeks"]
            }
          },
          icdCodes: {
            primary: {
              code: "K21.9",
              description: "Gastroesophageal reflux disease without esophagitis",
              confidence: "high"
            },
            secondary: [],
            notes: "Primary diagnosis based on clinical presentation"
          },
          prescriptions: {
            prescribed: [
              {
                medication: "Omeprazole (Prilosec)",
                dosage: "20mg capsule",
                frequency: "Once daily",
                duration: "4 weeks",
                instructions: "Take 30 minutes before breakfast",
                indication: "Gastroesophageal reflux disease"
              }
            ],
            discontinued: [],
            allergies: ["NKDA (No Known Drug Allergies)"],
            interactions: [],
            notes: "Monitor for symptom improvement over 2-4 weeks"
          }
        });
      }, 2000); // Simulate 2 second processing time
    });
  }

  /**
   * Mock transcription
   */
  static generateMockTranscription(audioChunk, options = {}) {
    const mockTranscriptions = [
      "Hello, what brings you in today?",
      "I've been having chest pain for about three days now.",
      "Can you describe the pain? Is it sharp or dull?",
      "It's more of a burning sensation, especially after I eat.",
      "Any radiation to your arms or jaw?",
      "No, it stays right in the center of my chest.",
      "Have you had any shortness of breath?",
      "No, just the burning pain.",
      "Let me examine you. Your heart sounds normal.",
      "That's reassuring to hear.",
      "I think this might be acid reflux. I'll prescribe something for that.",
      "Thank you, doctor. When should I follow up?"
    ];

    const randomTranscription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
    
    return Promise.resolve({
      text: randomTranscription,
      confidence: 0.95,
      speaker: options.speaker || 'unknown',
      provider: 'mock',
      timestamp: new Date()
    });
  }

  /**
   * Check if we should use mock mode
   */
  static shouldUseMockMode() {
    return process.env.USE_MOCK_AI === 'true' || !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your-openai-api-key');
  }
}

module.exports = MockAIService;
