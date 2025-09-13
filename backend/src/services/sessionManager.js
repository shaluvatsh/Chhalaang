const { v4: uuidv4 } = require('uuid');

// In-memory session store (use Redis in production)
const activeSessions = new Map();
const sessionUsers = new Map();

/**
 * Session Manager Service
 * Handles session creation, management, and cleanup
 */
class SessionManager {
  /**
   * Create a new session
   */
  createSession(doctorName, patientName = null) {
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      doctor: {
        name: doctorName,
        socketId: null,
        joinedAt: null
      },
      patient: {
        name: patientName,
        socketId: null,
        joinedAt: null
      },
      status: 'waiting', // waiting, active, ended
      transcript: [],
      isRecording: false,
      merDocument: null,
      metadata: {
        createdAt: new Date(),
        lastActivity: new Date(),
        recordingStartTime: null,
        recordingEndTime: null
      }
    };
    
    activeSessions.set(sessionId, session);
    console.log(`📝 Session created: ${sessionId} for Dr. ${doctorName}`);
    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId) {
    return activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  getAllSessions() {
    return Array.from(activeSessions.entries()).map(([id, session]) => ({
      id,
      ...session
    }));
  }

  /**
   * Add user to session
   */
  addUserToSession(sessionId, userRole, socketId) {
    const session = activeSessions.get(sessionId);
    if (session) {
      // Validate userRole
      if (!['doctor', 'patient'].includes(userRole)) {
        console.warn(`Invalid userRole: ${userRole}, defaulting to 'patient'`);
        userRole = 'patient';
      }
      
      // Ensure the role object exists
      if (!session[userRole]) {
        session[userRole] = { name: 'Unknown', socketId: null, joinedAt: null };
      }
      
      session[userRole].socketId = socketId;
      session[userRole].joinedAt = new Date();
      sessionUsers.set(socketId, sessionId);
      session.metadata.lastActivity = new Date();
      
      // Update session status
      if (session.doctor.socketId && session.patient.socketId) {
        session.status = 'active';
      }
      
      console.log(`👤 User joined session ${sessionId}: ${userRole} (${socketId})`);
      return session;
    }
    return null;
  }

  /**
   * Remove user from session
   */
  removeUserFromSession(socketId) {
    const sessionId = sessionUsers.get(socketId);
    if (sessionId) {
      const session = activeSessions.get(sessionId);
      if (session) {
        // Find and remove user from session
        ['doctor', 'patient'].forEach(role => {
          if (session[role].socketId === socketId) {
            session[role].socketId = null;
            session[role].joinedAt = null;
            console.log(`👤 User left session ${sessionId}: ${role} (${socketId})`);
          }
        });
        
        session.metadata.lastActivity = new Date();
        sessionUsers.delete(socketId);
        
        // Update session status
        if (!session.doctor.socketId && !session.patient.socketId) {
          session.status = 'ended';
        }
        
        return { sessionId, session };
      }
    }
    return null;
  }

  /**
   * Get session ID by socket ID
   */
  getSessionIdBySocketId(socketId) {
    return sessionUsers.get(socketId);
  }

  /**
   * Add transcript entry to session
   */
  addTranscriptEntry(sessionId, entry) {
    const session = activeSessions.get(sessionId);
    if (session) {
      session.transcript.push({
        id: Date.now(),
        ...entry,
        timestamp: new Date()
      });
      session.metadata.lastActivity = new Date();
      return true;
    }
    return false;
  }

  /**
   * Start recording for a session
   */
  startRecording(sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
      session.isRecording = true;
      session.metadata.recordingStartTime = new Date();
      console.log(`🔴 Recording started for session ${sessionId}`);
      return true;
    }
    return false;
  }

  /**
   * Stop recording for a session
   */
  stopRecording(sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
      session.isRecording = false;
      session.metadata.recordingEndTime = new Date();
      console.log(`⏹️ Recording stopped for session ${sessionId}`);
      return true;
    }
    return false;
  }

  /**
   * Save MER document to session
   */
  saveMERDocument(sessionId, merDocument) {
    const session = activeSessions.get(sessionId);
    if (session) {
      session.merDocument = merDocument;
      session.metadata.lastActivity = new Date();
      return true;
    }
    return false;
  }

  /**
   * End a session
   */
  endSession(sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
      // Remove all users from session tracking
      ['doctor', 'patient'].forEach(role => {
        if (session[role].socketId) {
          sessionUsers.delete(session[role].socketId);
        }
      });
      
      session.status = 'ended';
      session.metadata.endedAt = new Date();
      
      // For now, keep sessions in memory for retrieval
      // In production, move to permanent storage and remove from active sessions
      console.log(`🔚 Session ended: ${sessionId}`);
      return session;
    }
    return null;
  }

  /**
   * Cleanup old sessions (call periodically)
   */
  cleanupOldSessions(maxAgeHours = 24) {
    const now = new Date();
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    let cleaned = 0;
    
    for (const [sessionId, session] of activeSessions.entries()) {
      const age = now - session.metadata.createdAt;
      if (age > maxAge && session.status === 'ended') {
        activeSessions.delete(sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🗑️ Cleaned up ${cleaned} old sessions`);
    }
    
    return cleaned;
  }

  /**
   * Update session ID (for custom session IDs)
   */
  updateSessionId(oldId, newId) {
    const session = activeSessions.get(oldId);
    if (session) {
      session.id = newId;
      activeSessions.delete(oldId);
      activeSessions.set(newId, session);
      console.log(`📝 Session ID updated: ${oldId} → ${newId}`);
      return session;
    }
    return null;
  }

  /**
   * Create or get session with custom ID
   */
  createOrGetSession(sessionId, doctorName = 'Doctor', patientName = null) {
    let session = activeSessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        doctor: {
          name: doctorName,
          socketId: null,
          joinedAt: null
        },
        patient: {
          name: patientName,
          socketId: null,
          joinedAt: null
        },
        status: 'waiting', // waiting, active, ended
        transcript: [],
        isRecording: false,
        merDocument: null,
        metadata: {
          createdAt: new Date(),
          lastActivity: new Date(),
          recordingStartTime: null,
          recordingEndTime: null
        }
      };
      
      activeSessions.set(sessionId, session);
      console.log(`📝 Session created/retrieved: ${sessionId}`);
    }
    return session;
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    const sessions = Array.from(activeSessions.values());
    return {
      total: sessions.length,
      active: sessions.filter(s => s.status === 'active').length,
      waiting: sessions.filter(s => s.status === 'waiting').length,
      ended: sessions.filter(s => s.status === 'ended').length,
      recording: sessions.filter(s => s.isRecording).length
    };
  }
}

// Create singleton instance
const sessionManager = new SessionManager();

// Cleanup old sessions every hour
setInterval(() => {
  sessionManager.cleanupOldSessions();
}, 60 * 60 * 1000);

module.exports = sessionManager;
