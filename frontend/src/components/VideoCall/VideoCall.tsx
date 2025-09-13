import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Grid,
  Card,
  Typography,
  Button,
  IconButton,
  Chip,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Videocam,
  VideocamOff,
  Mic,
  MicOff,
  CallEnd,
  RecordVoiceOver,
  Stop,
  Dashboard,
  Subtitles
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import socketService from '../../services/socketService';

interface MediaStreamError extends Error {
  name: string;
  message: string;
}

interface VideoCallProps {
  user: { name: string; role: 'doctor' | 'patient' };
  sessionId: string;
  onLeaveSession: () => void;
}

interface TranscriptEntry {
  id: number;
  speaker: string;
  speakerName: string;
  text: string;
  timestamp: Date;
  confidence: number;
}

const VideoCall: React.FC<VideoCallProps> = ({ user, sessionId, onLeaveSession }) => {
  const navigate = useNavigate();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [remoteUser, setRemoteUser] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    initializeMedia();
    setupSocketListeners();
    
    return () => {
      cleanupMedia();
    };
  }, []);

  const initializeMedia = async () => {
    try {
      console.log('Requesting camera and microphone access...');
      
      // Try to get real media first
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        console.log('Real media access granted');
      } catch (realMediaError) {
        console.log('Real media failed, creating mock video stream...');
        // Create a mock video stream for testing when camera is in use
        stream = await createMockVideoStream();
      }
      
      console.log('Setting up local video');
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setConnectionStatus('connected');
      console.log('Local video initialized successfully');
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setConnectionStatus('disconnected');
      
      // Show user-friendly error message
      const mediaError = error as MediaStreamError;
      if (mediaError.name === 'NotAllowedError') {
        alert('Camera and microphone access denied. Please allow access and refresh the page.');
      } else if (mediaError.name === 'NotFoundError') {
        alert('No camera or microphone found. Please check your devices.');
      } else {
        alert('Error accessing camera/microphone: ' + (mediaError.message || 'Unknown error'));
      }
    }
  };

  // Create a mock video stream with colored canvas for testing
  const createMockVideoStream = async (): Promise<MediaStream> => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    
    // Create different colors for different users
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    const userColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Animate the canvas
    const animate = () => {
      ctx.fillStyle = userColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add some text
      ctx.fillStyle = 'white';
      ctx.font = '32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Mock Camera Feed`, canvas.width / 2, canvas.height / 2 - 20);
      ctx.fillText(`${user.role.toUpperCase()}: ${user.name}`, canvas.width / 2, canvas.height / 2 + 20);
      ctx.fillText(`${new Date().toLocaleTimeString()}`, canvas.width / 2, canvas.height / 2 + 60);
      
      requestAnimationFrame(animate);
    };
    animate();
    
    // Get stream from canvas
    const stream = canvas.captureStream(30);
    
    // Add a mock audio track
    try {
      const audioCtx = new AudioContext();
      const oscillator = audioCtx.createOscillator();
      const dest = audioCtx.createMediaStreamDestination();
      oscillator.connect(dest);
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      oscillator.start();
      
      // Add audio track to stream
      dest.stream.getAudioTracks().forEach(track => {
        stream.addTrack(track);
      });
    } catch (audioError) {
      console.log('Could not create mock audio, continuing with video only');
    }
    
    return stream;
  };

  const setupSocketListeners = () => {
    socketService.on('user-joined', (data) => {
      console.log('User joined:', data);
      setRemoteUser({ name: data.userName, role: data.userRole });
    });

    socketService.on('user-left', (data) => {
      console.log('User left:', data);
      setRemoteUser(null);
    });

    socketService.on('session-joined', (data) => {
      console.log('Session joined:', data);
      // Check if there are other users already in the session
      if (data.otherUsers && data.otherUsers.length > 0) {
        const otherUser = data.otherUsers[0]; // Get the first other user
        setRemoteUser({ name: otherUser.userName, role: otherUser.userRole });
        console.log('Found existing user in session:', otherUser);
      }
    });

    socketService.on('live-transcription', (data: TranscriptEntry) => {
      setTranscript(prev => [...prev, data]);
    });

    socketService.on('recording-started', (data) => {
      setIsRecording(true);
      console.log('Recording started:', data);
    });

    socketService.on('recording-stopped', (data) => {
      setIsRecording(false);
      console.log('Recording stopped:', data);
    });
  };

  const cleanupMedia = () => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const toggleVideo = () => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const startRecording = () => {
    if (user.role === 'doctor') {
      socketService.emit('start-recording', { sessionId });
    }
  };

  const stopRecording = () => {
    if (user.role === 'doctor') {
      socketService.emit('stop-recording', { sessionId });
    }
  };

  const handleLeaveCall = () => {
    cleanupMedia();
    onLeaveSession();
    navigate('/');
  };

  const openDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'grey.900' }}>
      {/* Header */}
      <Box sx={{ p: 2, bgcolor: 'grey.800', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" color="white" gutterBottom>
            Session: {sessionId.substring(0, 8)}...
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip label={`${user.name} (${user.role})`} color="primary" size="small" />
            {remoteUser && (
              <Chip label={`${remoteUser.name} (${remoteUser.role})`} color="secondary" size="small" />
            )}
            <Chip 
              label={connectionStatus} 
              color={connectionStatus === 'connected' ? 'success' : 'warning'} 
              size="small" 
            />
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          {user.role === 'doctor' && (
            <>
              <Button
                variant="outlined"
                startIcon={<Dashboard />}
                onClick={openDashboard}
                sx={{ color: 'white', borderColor: 'white' }}
              >
                Dashboard
              </Button>
            </>
          )}
          
          <Button
            variant="outlined"
            startIcon={<Subtitles />}
            onClick={() => setShowTranscript(true)}
            sx={{ color: 'white', borderColor: 'white' }}
          >
            Transcript ({transcript.length})
          </Button>
        </Box>
      </Box>

      {/* Video Area */}
      <Box sx={{ flexGrow: 1, position: 'relative', p: 2 }}>
        <Grid container spacing={2} sx={{ height: '100%' }}>
          {/* Remote Video */}
          <Grid item xs={12} md={8}>
            <Card sx={{ height: '100%', bgcolor: 'grey.800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {remoteUser ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '12px'
                  }}
                />
              ) : (
                <Box textAlign="center" color="grey.400">
                  <Typography variant="h6" gutterBottom>
                    Waiting for {user.role === 'doctor' ? 'patient' : 'doctor'} to join...
                  </Typography>
                  <Typography variant="body2">
                    Share session ID: {sessionId}
                  </Typography>
                </Box>
              )}
            </Card>
          </Grid>

          {/* Local Video */}
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', bgcolor: 'grey.700', overflow: 'hidden' }}>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
              
              {/* Local Video Overlay */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  bgcolor: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  px: 1,
                  borderRadius: 1,
                  fontSize: '0.75rem'
                }}
              >
                You ({user.name})
              </Box>
            </Card>
          </Grid>
        </Grid>

        {/* Recording Indicator */}
        {isRecording && (
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: 16,
              bgcolor: 'error.main',
              color: 'white',
              px: 2,
              py: 1,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                bgcolor: 'white',
                borderRadius: '50%',
                animation: 'blink 1s infinite'
              }}
            />
            <Typography variant="body2" fontWeight="bold">
              RECORDING
            </Typography>
          </Box>
        )}
      </Box>

      {/* Controls */}
      <Box
        sx={{
          p: 2,
          bgcolor: 'grey.800',
          display: 'flex',
          justifyContent: 'center',
          gap: 2
        }}
      >
        <IconButton
          onClick={toggleVideo}
          sx={{
            bgcolor: isVideoEnabled ? 'primary.main' : 'error.main',
            color: 'white',
            '&:hover': {
              bgcolor: isVideoEnabled ? 'primary.dark' : 'error.dark'
            }
          }}
        >
          {isVideoEnabled ? <Videocam /> : <VideocamOff />}
        </IconButton>

        <IconButton
          onClick={toggleAudio}
          sx={{
            bgcolor: isAudioEnabled ? 'primary.main' : 'error.main',
            color: 'white',
            '&:hover': {
              bgcolor: isAudioEnabled ? 'primary.dark' : 'error.dark'
            }
          }}
        >
          {isAudioEnabled ? <Mic /> : <MicOff />}
        </IconButton>

        {user.role === 'doctor' && (
          <IconButton
            onClick={isRecording ? stopRecording : startRecording}
            sx={{
              bgcolor: isRecording ? 'error.main' : 'success.main',
              color: 'white',
              '&:hover': {
                bgcolor: isRecording ? 'error.dark' : 'success.dark'
              }
            }}
          >
            {isRecording ? <Stop /> : <RecordVoiceOver />}
          </IconButton>
        )}

        <Fab
          color="error"
          onClick={handleLeaveCall}
          sx={{ mx: 2 }}
        >
          <CallEnd />
        </Fab>
      </Box>

      {/* Transcript Dialog */}
      <Dialog
        open={showTranscript}
        onClose={() => setShowTranscript(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Live Transcript
          <Typography variant="body2" color="text.secondary">
            {transcript.length} entries
          </Typography>
        </DialogTitle>
        <DialogContent>
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {transcript.map((entry, index) => (
              <React.Fragment key={entry.id}>
                <ListItem alignItems="flex-start">
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Chip
                          label={entry.speakerName}
                          size="small"
                          color={entry.speaker === 'doctor' ? 'primary' : 'secondary'}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ({Math.round(entry.confidence * 100)}%)
                        </Typography>
                      </Box>
                    }
                    secondary={entry.text}
                  />
                </ListItem>
                {index < transcript.length - 1 && <Divider />}
              </React.Fragment>
            ))}
            {transcript.length === 0 && (
              <Box textAlign="center" py={4} color="text.secondary">
                <Typography>No transcript entries yet</Typography>
                <Typography variant="body2">
                  {user.role === 'doctor' ? 'Start recording to begin transcription' : 'Waiting for doctor to start recording'}
                </Typography>
              </Box>
            )}
          </List>
        </DialogContent>
      </Dialog>

      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}
      </style>
    </Box>
  );
};

export default VideoCall;
