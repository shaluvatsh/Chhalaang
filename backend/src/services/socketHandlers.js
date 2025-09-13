const TranscriptionService = require('./transcriptionService');
const MERGeneratorService = require('./merGeneratorService');
const SessionManager = require('./sessionManager');

module.exports = (io) => {
  console.log('🔌 Initializing Socket.IO handlers...');
  
  io.on('connection', (socket) => {
    console.log(`👤 User connected: ${socket.id}`);
    
    // Handle user joining a session
    socket.on('join-session', async (data) => {
      try {
        const { sessionId, userRole, userName } = data;
        
        if (!sessionId || !userRole || !userName) {
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }
        
        console.log(`🏥 ${userRole} "${userName}" attempting to join session: ${sessionId}`);
        
        // Join the socket room
        socket.join(sessionId);
        
        // Create or get session - this ensures the session always exists
        const session = SessionManager.createOrGetSession(sessionId, userName);
        
        // Update user name in session if not already set
        if (userRole === 'doctor' && !session.doctor.name) {
          session.doctor.name = userName;
        } else if (userRole === 'patient' && !session.patient.name) {
          session.patient.name = userName;
        }
        
        // Add user to session management
        const updatedSession = SessionManager.addUserToSession(sessionId, userRole, socket.id);
        
        if (!updatedSession) {
          socket.emit('error', { message: 'Failed to join session' });
          return;
        }
        
        console.log(`✅ ${userRole} "${userName}" joined session: ${sessionId}`);
        console.log(`📊 Session status: Doctor=${!!updatedSession.doctor.socketId}, Patient=${!!updatedSession.patient.socketId}`);
        
        // Notify others in the session about the new user
        socket.to(sessionId).emit('user-joined', {
          userRole,
          userName,
          timestamp: new Date()
        });
        
        // Send current session state to the joined user, including info about other connected users
        const otherUsers = [];
        
        // If doctor is connected and this user is not the doctor
        if (updatedSession.doctor.socketId && userRole !== 'doctor') {
          otherUsers.push({
            userRole: 'doctor',
            userName: updatedSession.doctor.name,
            isConnected: true
          });
        }
        
        // If patient is connected and this user is not the patient
        if (updatedSession.patient.socketId && userRole !== 'patient') {
          otherUsers.push({
            userRole: 'patient', 
            userName: updatedSession.patient.name,
            isConnected: true
          });
        }
        
        // Send session info to the newly joined user
        socket.emit('session-joined', {
          sessionId,
          userRole,
          otherUsers, // Include other connected users
          session: {
            doctor: {
              name: updatedSession.doctor.name,
              isConnected: !!updatedSession.doctor.socketId
            },
            patient: {
              name: updatedSession.patient.name,
              isConnected: !!updatedSession.patient.socketId
            },
            transcript: updatedSession.transcript.slice(-20), // Send last 20 messages
            isRecording: updatedSession.isRecording,
            status: updatedSession.status
          }
        });
        
        // If there are other users, also notify the new user about them immediately
        otherUsers.forEach(otherUser => {
          socket.emit('user-joined', {
            userRole: otherUser.userRole,
            userName: otherUser.userName,
            timestamp: new Date()
          });
        });
        
      } catch (error) {
        console.error('Error joining session:', error);
        socket.emit('error', { message: 'Failed to join session' });
      }
    });
    
    // Handle WebRTC signaling
    socket.on('webrtc-offer', (data) => {
      console.log(`📡 WebRTC offer from ${socket.id}`);
      socket.to(data.sessionId).emit('webrtc-offer', {
        offer: data.offer,
        from: socket.id
      });
    });
    
    socket.on('webrtc-answer', (data) => {
      console.log(`📡 WebRTC answer from ${socket.id}`);
      socket.to(data.sessionId).emit('webrtc-answer', {
        answer: data.answer,
        from: socket.id
      });
    });
    
    socket.on('webrtc-ice-candidate', (data) => {
      socket.to(data.sessionId).emit('webrtc-ice-candidate', {
        candidate: data.candidate,
        from: socket.id
      });
    });
    
    // Handle audio stream for transcription
    socket.on('audio-stream', async (data) => {
      try {
        const userSession = SessionManager.removeUserFromSession(socket.id);
        if (!userSession) return;
        
        const { sessionId, session } = userSession;
        // Re-add user (removeUserFromSession was used just to get session info)
        SessionManager.addUserToSession(sessionId, data.userRole || 'unknown', socket.id);
        
        if (!session.isRecording) {
          return; // Not recording, ignore audio
        }
        
        // Process audio chunk through transcription service
        const transcriptionResult = await TranscriptionService.processAudioChunk(
          Buffer.from(data.audioData, 'base64'),
          {
            speaker: data.userRole || 'unknown',
            speakerName: data.userName || 'Unknown',
            sessionId: sessionId,
            timestamp: new Date()
          }
        );
        
        if (transcriptionResult && transcriptionResult.text) {
          // Add to session transcript
          const transcriptEntry = {
            id: Date.now(),
            speaker: data.userRole || 'unknown',
            speakerName: data.userName || 'Unknown',
            text: transcriptionResult.text,
            timestamp: new Date(),
            confidence: transcriptionResult.confidence || 0.9
          };
          
          session.transcript.push(transcriptEntry);
          session.metadata.totalMessages++;
          session.metadata.lastActivity = new Date();
          
          // Broadcast live transcription to all users in session
          io.to(sessionId).emit('live-transcription', transcriptEntry);
          
          console.log(`📝 [${sessionId}] ${data.userRole}: ${transcriptionResult.text.substring(0, 100)}...`);
        }
        
      } catch (error) {
        console.error('Error processing audio stream:', error);
        socket.emit('transcription-error', { message: 'Failed to process audio' });
      }
    });
    
    // Start recording
    socket.on('start-recording', async (data) => {
      try {
        const userSession = SessionManager.removeUserFromSession(socket.id);
        if (!userSession) return;
        
        const { sessionId, session } = userSession;
        // Re-add user
        SessionManager.addUserToSession(sessionId, data.userRole || 'doctor', socket.id);
        
        // Only doctors can start recording
        if (data.userRole !== 'doctor') {
          socket.emit('error', { message: 'Only doctors can start recording' });
          return;
        }
        
        session.isRecording = true;
        session.status = 'recording';
        session.recordingStartTime = new Date();
        
        io.to(sessionId).emit('recording-started', {
          startedBy: data.userName || 'Doctor',
          timestamp: session.recordingStartTime
        });
        
        console.log(`🔴 Recording started for session ${sessionId} by ${data.userName}`);
        
      } catch (error) {
        console.error('Error starting recording:', error);
        socket.emit('error', { message: 'Failed to start recording' });
      }
    });
    
    // Stop recording
    socket.on('stop-recording', async (data) => {
      try {
        const userSession = SessionManager.removeUserFromSession(socket.id);
        if (!userSession) return;
        
        const { sessionId, session } = userSession;
        // Re-add user
        SessionManager.addUserToSession(sessionId, data.userRole || 'doctor', socket.id);
        
        if (data.userRole !== 'doctor') {
          socket.emit('error', { message: 'Only doctors can stop recording' });
          return;
        }
        
        if (!session.isRecording) {
          socket.emit('error', { message: 'Session is not currently recording' });
          return;
        }
        
        session.isRecording = false;
        session.status = 'completed';
        session.recordingEndTime = new Date();
        
        // Generate MER document if transcript is available
        if (session.transcript.length > 0) {
          try {
            console.log(`📋 Generating MER for session ${sessionId}...`);
            
            const merDocument = await MERGeneratorService.generateMER({
              transcript: session.transcript,
              sessionDuration: session.recordingEndTime - session.recordingStartTime,
              doctor: session.doctor.name,
              patient: session.patient.name || 'Patient',
              sessionId: sessionId
            });
            
            // Store MER in session for later retrieval
            session.merDocument = merDocument;
            
            // Send MER to doctor only
            if (session.doctor.socketId) {
              io.to(session.doctor.socketId).emit('mer-generated', {
                document: merDocument,
                timestamp: new Date()
              });
            }
            
            console.log(`✅ MER generated for session ${sessionId}`);
            
          } catch (merError) {
            console.error('Error generating MER:', merError);
            socket.emit('mer-generation-error', { 
              message: 'Failed to generate MER document automatically' 
            });
          }
        }
        
        io.to(sessionId).emit('recording-stopped', {
          stoppedBy: data.userName || 'Doctor',
          timestamp: session.recordingEndTime,
          duration: session.recordingEndTime - session.recordingStartTime,
          transcriptLength: session.transcript.length
        });
        
        console.log(`⏹️ Recording stopped for session ${sessionId}`);
        
      } catch (error) {
        console.error('Error stopping recording:', error);
        socket.emit('error', { message: 'Failed to stop recording' });
      }
    });
    
    // Manual MER generation request
    socket.on('generate-mer', async (data) => {
      try {
        const userSession = SessionManager.removeUserFromSession(socket.id);
        if (!userSession) return;
        
        const { sessionId, session } = userSession;
        // Re-add user
        SessionManager.addUserToSession(sessionId, data.userRole || 'doctor', socket.id);
        
        if (data.userRole !== 'doctor') {
          socket.emit('error', { message: 'Only doctors can generate MER documents' });
          return;
        }
        
        if (session.transcript.length === 0) {
          socket.emit('error', { message: 'No transcript available for MER generation' });
          return;
        }
        
        console.log(`📋 Manual MER generation requested for session ${sessionId}`);
        
        const merDocument = await MERGeneratorService.generateMER({
          transcript: session.transcript,
          doctor: session.doctor.name,
          patient: session.patient.name || 'Patient',
          sessionId: sessionId,
          customInstructions: data.customInstructions
        });
        
        // Store in session
        session.merDocument = merDocument;
        
        socket.emit('mer-generated', {
          document: merDocument,
          timestamp: new Date()
        });
        
        console.log(`✅ Manual MER generated for session ${sessionId}`);
        
      } catch (error) {
        console.error('Error generating MER manually:', error);
        socket.emit('mer-generation-error', { message: 'Failed to generate MER document' });
      }
    });
    
    // Handle real-time text messages/notes
    socket.on('send-message', (data) => {
      try {
        const userSession = SessionManager.removeUserFromSession(socket.id);
        if (!userSession) return;
        
        const { sessionId } = userSession;
        // Re-add user
        SessionManager.addUserToSession(sessionId, data.userRole || 'unknown', socket.id);
        
        const messageData = {
          id: Date.now(),
          sender: data.userName || 'Unknown',
          senderRole: data.userRole || 'unknown',
          message: data.message,
          timestamp: new Date(),
          type: 'chat'
        };
        
        // Broadcast message to all users in session
        io.to(sessionId).emit('new-message', messageData);
        
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      try {
        const userSession = SessionManager.removeUserFromSession(socket.id);
        if (userSession) {
          const { sessionId, session } = userSession;
          
          // Determine which role disconnected
          let disconnectedRole = 'unknown';
          let disconnectedName = 'Unknown User';
          
          if (!session.doctor.socketId && session.doctor.name) {
            disconnectedRole = 'doctor';
            disconnectedName = session.doctor.name;
          } else if (!session.patient.socketId && session.patient.name) {
            disconnectedRole = 'patient';
            disconnectedName = session.patient.name;
          }
          
          console.log(`👤 ${disconnectedRole} "${disconnectedName}" disconnected from session ${sessionId}`);
          
          // Notify others in the session
          socket.to(sessionId).emit('user-left', {
            userRole: disconnectedRole,
            userName: disconnectedName,
            timestamp: new Date()
          });
          
          // If both users left, mark session as inactive
          if (!session.doctor.socketId && !session.patient.socketId) {
            session.status = 'inactive';
            console.log(`� Session ${sessionId} is now inactive (no users connected)`);
          }
        }
        
        console.log(`🔌 Socket disconnected: ${socket.id}`);
        
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    });
    
    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });
  
  // Periodic cleanup of inactive sessions
  setInterval(() => {
    const now = new Date();
    const sessions = SessionManager.activeSessions;
    
    sessions.forEach((session, sessionId) => {
      const timeSinceLastActivity = now - session.metadata.lastActivity;
      const maxInactiveTime = 4 * 60 * 60 * 1000; // 4 hours
      
      if (timeSinceLastActivity > maxInactiveTime) {
        sessions.delete(sessionId);
        console.log(`🗑️ Cleaned up inactive session: ${sessionId}`);
      }
    });
  }, 30 * 60 * 1000); // Check every 30 minutes
  
  console.log('✅ Socket.IO handlers initialized');
};
