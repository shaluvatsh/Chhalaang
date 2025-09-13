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

// Extend Window interface for Speech Recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
  
  // Global SpeechRecognition interface
  var SpeechRecognition: {
    new(): SpeechRecognition;
  };
  
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

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
  timestamp: string; // Changed from Date to string
  confidence: number;
}

const VideoCall: React.FC<VideoCallProps> = ({ user, sessionId, onLeaveSession }) => {
  const navigate = useNavigate();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isOfferPendingRef = useRef<boolean>(false); // Track if offer is pending
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const isUsingSpeechRecognition = useRef<boolean>(false);
  
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [remoteUser, setRemoteUser] = useState<{ name: string; role: string } | null>(null);

  const createMockVideoStream = React.useCallback(async (): Promise<MediaStream> => {
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
  }, [user.role, user.name]);

  // Initialize WebRTC peer connection
  const initializePeerConnection = React.useCallback(() => {
    console.log('Initializing WebRTC peer connection');
    
    // Clean up existing connection first
    if (peerConnectionRef.current) {
      console.log('Cleaning up existing peer connection');
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      isOfferPendingRef.current = false; // Reset offer flag
    }
    
    // Create RTCPeerConnection with ICE servers
    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    const pc = peerConnectionRef.current;

    // Add local stream to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
      console.log('Added local stream tracks to peer connection');
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('🎥 Received remote stream, setting to video element');
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        console.log('✅ Remote video stream set successfully');
      } else {
        console.warn('❌ Could not set remote stream - video ref or stream missing');
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate');
        socketService.emit('webrtc-ice-candidate', {
          sessionId: sessionId,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('WebRTC connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log('✅ WebRTC peer connection established');
      }
    };

  }, [sessionId]);

  // Create WebRTC offer
  const createOffer = React.useCallback(async () => {
    if (!peerConnectionRef.current) {
      console.log('❌ Cannot create offer - no peer connection');
      return;
    }
    
    // Prevent multiple simultaneous offers
    if (isOfferPendingRef.current) {
      console.log('⏳ Offer already pending, skipping...');
      return;
    }
    
    // Check if we're already in the process of creating an offer or have a remote description
    const signalingState = peerConnectionRef.current.signalingState;
    console.log('🔍 Current signaling state before offer:', signalingState);
    
    if (signalingState !== 'stable') {
      console.log('❌ Cannot create offer - connection not in stable state:', signalingState);
      
      // If we're in have-local-offer, it means we already sent an offer, skip
      if (signalingState === 'have-local-offer') {
        console.log('⏳ Offer already pending, waiting for answer...');
        return;
      }
      
      // For other states, try to reset the connection
      console.log('🔄 Resetting peer connection due to invalid state');
      initializePeerConnection();
      
      // Wait a bit and try again
      setTimeout(() => {
        if (peerConnectionRef.current?.signalingState === 'stable') {
          createOffer();
        }
      }, 1000);
      return;
    }
    
    try {
      isOfferPendingRef.current = true;
      console.log('🔥 Creating WebRTC offer');
      
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      // Double-check state before setting local description
      if (peerConnectionRef.current.signalingState !== 'stable') {
        console.log('❌ State changed before setting local description:', peerConnectionRef.current.signalingState);
        isOfferPendingRef.current = false;
        return;
      }
      
      await peerConnectionRef.current.setLocalDescription(offer);
      console.log('✅ Local description set for offer, new state:', peerConnectionRef.current.signalingState);
      
      socketService.emit('webrtc-offer', {
        sessionId: sessionId,
        offer: offer
      });
      console.log('✅ WebRTC offer sent');
    } catch (error) {
      console.error('❌ Error creating WebRTC offer:', error);
      isOfferPendingRef.current = false;
      
      // Reset connection on error
      console.log('🔄 Resetting peer connection due to offer error');
      initializePeerConnection();
    }
  }, [sessionId, initializePeerConnection]);

  const initializeMedia = React.useCallback(async () => {
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
      
      // Store the local stream
      localStreamRef.current = stream;
      
      console.log('Setting up local video');
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Initialize WebRTC peer connection
      initializePeerConnection();
      
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
  }, [createMockVideoStream, initializePeerConnection]);

  const setupSocketListeners = React.useCallback(() => {
    console.log('Setting up socket listeners...');
    
    socketService.on('user-joined', (data) => {
      console.log('🔗 User joined event received:', data);
      setRemoteUser({ name: data.userName, role: data.userRole });
      
      // Only doctor should initiate WebRTC offers to avoid race conditions
      if (user.role === 'doctor' && !peerConnectionRef.current) {
        console.log('🔥 Doctor initiating WebRTC offer to new user...');
        setTimeout(() => {
          if (peerConnectionRef.current && localStreamRef.current && peerConnectionRef.current.signalingState === 'stable') {
            createOffer();
          } else {
            console.warn('❌ Cannot create offer - connection not ready');
          }
        }, 1000);
      }
    });

    socketService.on('user-left', (data) => {
      console.log('📤 User left event received:', data);
      setRemoteUser(null);
      
      // Clean up peer connection when user leaves
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
        isOfferPendingRef.current = false; // Reset offer flag
      }
    });

    socketService.on('session-joined', (data) => {
      console.log('🏠 Session joined event received:', data);
      console.log('Session details:', {
        sessionId: data.sessionId,
        users: data.users,
        otherUsers: data.otherUsers,
        currentUser: data.currentUser
      });
      
      // Check if there are other users already in the session
      if (data.otherUsers && data.otherUsers.length > 0) {
        const otherUser = data.otherUsers[0]; // Get the first other user
        console.log('✅ Setting remote user from existing users:', otherUser);
        setRemoteUser({ name: otherUser.userName, role: otherUser.userRole });
        
        // Only doctor should initiate WebRTC connection to avoid race conditions
        if (user.role === 'doctor') {
          console.log('🔥 Doctor joining session with existing user, initiating WebRTC offer...');
          setTimeout(() => {
            if (peerConnectionRef.current && localStreamRef.current && peerConnectionRef.current.signalingState === 'stable') {
              createOffer();
            } else {
              console.warn('❌ Cannot create offer - connection not ready. State:', peerConnectionRef.current?.signalingState);
            }
          }, 1500); // Slightly longer delay for session joining
        } else {
          console.log('🎯 Patient waiting for doctor to initiate WebRTC connection...');
        }
      }
    });

    // WebRTC signaling events
    socketService.on('webrtc-offer', async (data) => {
      console.log('🔥 Received WebRTC offer');
      if (!peerConnectionRef.current) {
        console.log('No peer connection, initializing first');
        initializePeerConnection();
      }
      
      if (peerConnectionRef.current) {
        try {
          // Check signaling state before setting remote description
          if (peerConnectionRef.current.signalingState !== 'stable' && peerConnectionRef.current.signalingState !== 'have-local-offer') {
            console.log('❌ Cannot handle offer - invalid signaling state:', peerConnectionRef.current.signalingState);
            return;
          }
          
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
          console.log('✅ Remote description set from offer');
          
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          console.log('✅ Local description set with answer');
          
          socketService.emit('webrtc-answer', {
            sessionId: sessionId,
            answer: answer
          });
          console.log('✅ WebRTC answer sent');
        } catch (error) {
          console.error('❌ Error handling WebRTC offer:', error);
          // Reinitialize peer connection on error
          initializePeerConnection();
        }
      }
    });

    socketService.on('webrtc-answer', async (data) => {
      console.log('🔥 Received WebRTC answer');
      if (peerConnectionRef.current) {
        try {
          const currentState = peerConnectionRef.current.signalingState;
          console.log('🔍 Current signaling state when receiving answer:', currentState);
          
          // Only process answer if we're expecting one
          if (currentState === 'have-local-offer') {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
            console.log('✅ Remote description set from answer');
            
            // Reset the offer pending flag
            isOfferPendingRef.current = false;
          } else if (currentState === 'stable') {
            console.log('ℹ️ Connection already stable, ignoring duplicate answer');
            isOfferPendingRef.current = false;
          } else {
            console.log('❌ Cannot handle answer - invalid signaling state:', currentState);
          }
        } catch (error) {
          console.error('❌ Error handling WebRTC answer:', error);
          isOfferPendingRef.current = false;
        }
      }
    });

    socketService.on('webrtc-ice-candidate', async (data) => {
      console.log('🔥 Received ICE candidate');
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log('✅ ICE candidate added');
        } catch (error) {
          console.error('❌ Error handling ICE candidate:', error);
        }
      } else {
        console.log('⏳ Ignoring ICE candidate - no remote description yet');
      }
    });

    socketService.on('live-transcription', (data: TranscriptEntry) => {
      console.log('📝 Received live transcription:', data);
      setTranscript(prev => {
        console.log('📜 Adding to transcript. Previous length:', prev.length);
        const newTranscript = [...prev, data];
        console.log('📜 New transcript length:', newTranscript.length);
        return newTranscript;
      });
    });

    socketService.on('recording-started', (data) => {
      setIsRecording(true);
      console.log('Recording started:', data);
    });

    socketService.on('recording-stopped', (data) => {
      setIsRecording(false);
      console.log('Recording stopped:', data);
    });
    
    console.log('✅ Socket listeners setup complete');
  }, [createOffer, sessionId, initializePeerConnection, user.role]);

  useEffect(() => {
    initializeMedia();
    setupSocketListeners();
    
    return () => {
      cleanupMedia();
    };
  }, [initializeMedia, setupSocketListeners]);


  const cleanupMedia = () => {
    // Stop local media tracks
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
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

  // Test microphone function
  const testMicrophone = async () => {
    try {
      console.log('🧪 Testing microphone...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      microphone.connect(analyser);
      analyser.fftSize = 256;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b) / bufferLength;
        console.log('🔊 Microphone volume level:', volume);
        
        if (volume > 10) {
          console.log('✅ Microphone is working! Volume detected:', volume);
          alert('Microphone test successful! Volume: ' + volume);
        } else {
          console.log('🔇 No audio detected, trying again...');
          setTimeout(checkAudio, 500);
        }
      };
      
      setTimeout(checkAudio, 100);
      
      // Stop test after 10 seconds
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
        console.log('🛑 Microphone test ended');
      }, 10000);
      
    } catch (error) {
      console.error('❌ Microphone test failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert('Microphone test failed: ' + errorMessage);
    }
  };

  // FREE Browser-based Speech Recognition
  const startBrowserSpeechRecognition = () => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.log('❌ Speech Recognition not supported, falling back to audio recording');
        startAudioRecording();
        return;
      }

      console.log('🎯 Starting FREE browser speech recognition');
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      speechRecognitionRef.current = recognition;
      isUsingSpeechRecognition.current = true;
      
      let transcriptId = 0;

      recognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        setIsRecording(true);
        
        // Notify backend
        socketService.emit('start-recording', { 
          sessionId,
          userRole: user.role,
          userName: user.name
        });
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        console.log('📝 Speech recognition result received');
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence;
          
          if (result.isFinal && transcript.trim()) {
            console.log('✅ Final transcript:', transcript);
            
            // Add to local transcript immediately
            const transcriptEntry: TranscriptEntry = {
              id: transcriptId++,
              text: transcript.trim(),
              speaker: user.role,
              speakerName: user.name,
              timestamp: new Date().toLocaleTimeString(),
              confidence: confidence || 0.9
            };
            
            setTranscript(prev => [...prev, transcriptEntry]);
            
            // Send to backend for other users
            socketService.emit('live-transcription', {
              ...transcriptEntry,
              sessionId,
              userRole: user.role,
              userName: user.name
            });
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('❌ Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          console.log('No speech detected, continuing...');
        } else {
          console.log('Falling back to audio recording due to speech recognition error');
          startAudioRecording();
        }
      };

      recognition.onend = () => {
        console.log('🛑 Speech recognition ended');
        if (isUsingSpeechRecognition.current && isRecording) {
          // Restart recognition for continuous listening
          setTimeout(() => {
            if (speechRecognitionRef.current && isRecording) {
              speechRecognitionRef.current.start();
            }
          }, 100);
        }
      };

      recognition.start();
      
    } catch (error) {
      console.error('❌ Browser speech recognition failed:', error);
      startAudioRecording();
    }
  };

  // Fallback audio recording method
  const startAudioRecording = async () => {
    try {
      console.log('🎙️ Starting audio recording fallback...');
      
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Check if MediaRecorder is supported
      if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        console.warn('⚠️ WebM Opus not supported, trying other formats...');
      }

      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      isUsingSpeechRecognition.current = false;

      // Handle data available (audio chunks)
      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          console.log('🔊 Audio chunk received:', event.data.size, 'bytes');
          audioChunksRef.current.push(event.data);
          
          // Convert to base64 and send to backend
          const reader = new FileReader();
          reader.onload = () => {
            const base64Audio = (reader.result as string).split(',')[1];
            console.log('📤 Sending audio data to backend, size:', base64Audio.length);
            
            socketService.emit('audio-stream', {
              audioData: base64Audio,
              userRole: user.role,
              userName: user.name,
              sessionId: sessionId,
              timestamp: Date.now()
            });
          };
          reader.readAsDataURL(event.data);
        }
      });

      // Handle recording stop
      mediaRecorder.addEventListener('stop', () => {
        console.log('🛑 Recording stopped');
        audioStream.getTracks().forEach(track => track.stop());
      });

      // Start recording with small chunks for real-time processing
      mediaRecorder.start(3000); // 3-second chunks for real-time transcription
      setIsRecording(true);
      
      // Emit start recording event to backend
      socketService.emit('start-recording', { 
        sessionId,
        userRole: user.role,
        userName: user.name
      });
      
      console.log('✅ Audio recording started');
      
    } catch (error) {
      console.error('❌ Error starting audio recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const startRecording = async () => {
    if (user.role !== 'doctor') {
      console.log('❌ Only doctors can start recording');
      return;
    }

    // Try browser speech recognition first (FREE!)
    startBrowserSpeechRecognition();
  };

  const stopRecording = () => {
    if (user.role !== 'doctor') {
      console.log('❌ Only doctors can stop recording');
      return;
    }

    console.log('🛑 Stopping recording...');
    setIsRecording(false);
    
    // Stop speech recognition if active
    if (speechRecognitionRef.current && isUsingSpeechRecognition.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
      isUsingSpeechRecognition.current = false;
      console.log('✅ Speech recognition stopped');
    }
    
    // Stop audio recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      console.log('✅ Audio recording stopped');
    }

    socketService.emit('stop-recording', { 
      sessionId,
      userRole: user.role,
      userName: user.name  
    });
    
    console.log('✅ All recording stopped');
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
          
          <Button
            variant="outlined"
            startIcon={<Mic />}
            onClick={testMicrophone}
            sx={{ color: 'white', borderColor: 'white' }}
          >
            Test Mic
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
                  onLoadedMetadata={() => {
                    console.log('✅ Remote video metadata loaded');
                  }}
                  onError={(e) => {
                    console.error('❌ Remote video error:', e);
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
