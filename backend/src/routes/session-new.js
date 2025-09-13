const express = require('express');
const router = express.Router();
const sessionManager = require('../services/sessionManager');

/**
 * POST /api/session/create
 * Create a new session
 */
router.post('/create', (req, res) => {
  try {
    const { doctorName, patientName } = req.body;
    
    if (!doctorName) {
      return res.status(400).json({
        success: false,
        error: 'Doctor name is required'
      });
    }

    const session = sessionManager.createSession(doctorName, patientName);
    
    res.status(201).json({
      success: true,
      data: session,
      message: 'Session created successfully'
    });
    
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session'
    });
  }
});

/**
 * GET /api/session/:sessionId
 * Get session details
 */
router.get('/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }
    
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    res.json({
      success: true,
      data: session
    });
    
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session'
    });
  }
});

/**
 * GET /api/session
 * Get all sessions
 */
router.get('/', (req, res) => {
  try {
    const sessions = sessionManager.getAllSessions();
    const stats = sessionManager.getSessionStats();
    
    res.json({
      success: true,
      data: {
        sessions,
        stats
      }
    });
    
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sessions'
    });
  }
});

/**
 * DELETE /api/session/:sessionId
 * End a session
 */
router.delete('/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = sessionManager.endSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    res.json({
      success: true,
      data: session,
      message: 'Session ended successfully'
    });
    
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end session'
    });
  }
});

// Export just the router
module.exports = router;
