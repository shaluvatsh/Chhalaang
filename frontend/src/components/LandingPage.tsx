import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  Alert
} from '@mui/material';
import {
  VideoCall as VideoCallIcon,
  MedicalServices as MedicalIcon,
  Person as PersonIcon,
  Psychology as AIIcon
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';

interface LandingPageProps {
  onJoinSession: (user: { name: string; role: 'doctor' | 'patient' }, sessionId: string) => void;
  isConnected: boolean;
}

const LandingPage: React.FC<LandingPageProps> = ({ onJoinSession, isConnected }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'doctor' | 'patient'>('doctor');
  const [sessionId, setSessionId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState('');

  // Preset demo sessions for quick testing
  const demoSessions = [
    { id: 'DEMO-001', name: 'General Consultation' },
    { id: 'DEMO-002', name: 'Follow-up Visit' },
    { id: 'DEMO-003', name: 'Emergency Call' }
  ];

  const handleCreateSession = () => {
    if (!name.trim()) return;
    
    setIsJoining(true);
    const newSessionId = uuidv4().substring(0, 8).toUpperCase(); // Shorter, readable ID
    setCreatedSessionId(newSessionId);
    
    setTimeout(() => {
      onJoinSession({ name: name.trim(), role }, newSessionId);
      setIsJoining(false);
    }, 500);
  };

  const handleJoinDemoSession = (demoSessionId: string) => {
    if (!name.trim()) return;
    
    setIsJoining(true);
    setSessionId(demoSessionId);
    
    setTimeout(() => {
      onJoinSession({ name: name.trim(), role }, demoSessionId);
      setIsJoining(false);
    }, 500);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const handleJoinExistingSession = () => {
    if (!name.trim() || !sessionId.trim()) return;
    
    setIsJoining(true);
    
    setTimeout(() => {
      onJoinSession({ name: name.trim(), role }, sessionId.trim());
      setIsJoining(false);
    }, 500);
  };

  const features = [
    {
      icon: <VideoCallIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Real-time Video Calls',
      description: 'Secure WebRTC-based video consultations'
    },
    {
      icon: <AIIcon sx={{ fontSize: 40, color: 'secondary.main' }} />,
      title: 'AI Transcription',
      description: 'Live speech-to-text with speaker identification'
    },
    {
      icon: <MedicalIcon sx={{ fontSize: 40, color: 'success.main' }} />,
      title: 'MER Generation',
      description: 'Automatic SOAP notes, ICD-10 codes, and prescriptions'
    }
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        py: 4
      }}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Box textAlign="center" mb={6}>
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{ 
              color: 'white', 
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
            }}
          >
            AI Voice MER App
          </Typography>
          <Typography
            variant="h6"
            sx={{ 
              color: 'rgba(255,255,255,0.9)', 
              mb: 2,
              textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
            }}
          >
            Real-time Medical Encounter Records with AI Transcription
          </Typography>
          
          {/* Connection Status */}
          <Chip
            label={isConnected ? 'Connected to Server' : 'Connecting...'}
            color={isConnected ? 'success' : 'warning'}
            sx={{ mt: 1 }}
          />
        </Box>

        <Grid container spacing={4} alignItems="stretch">
          {/* Features Section */}
          <Grid item xs={12} md={6}>
            <Typography
              variant="h5"
              gutterBottom
              sx={{ color: 'white', fontWeight: 'bold', mb: 3 }}
            >
              Features
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {features.map((feature, index) => (
                <Card key={index} sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {feature.icon}
                    <Box>
                      <Typography variant="h6" fontWeight="bold">
                        {feature.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {feature.description}
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              ))}
            </Box>
          </Grid>

          {/* Join Session Section */}
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h5" gutterBottom fontWeight="bold" textAlign="center">
                  Join Session
                </Typography>

                {!isConnected && (
                  <Alert severity="warning" sx={{ mb: 3 }}>
                    Connecting to server...
                  </Alert>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* Name Input */}
                  <TextField
                    label="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    variant="outlined"
                    fullWidth
                    InputProps={{
                      startAdornment: <PersonIcon sx={{ color: 'action.active', mr: 1 }} />
                    }}
                  />

                  {/* Role Selection */}
                  <FormControl fullWidth>
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'doctor' | 'patient')}
                      label="Role"
                    >
                      <MenuItem value="doctor">Doctor</MenuItem>
                      <MenuItem value="patient">Patient</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Demo Sessions */}
                  <Box>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      Quick Join Demo Sessions:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {demoSessions.map((demo) => (
                        <Button
                          key={demo.id}
                          size="small"
                          variant="outlined"
                          disabled={!name.trim() || !isConnected || isJoining}
                          onClick={() => handleJoinDemoSession(demo.id)}
                          sx={{ fontSize: '0.75rem' }}
                        >
                          {demo.id}
                        </Button>
                      ))}
                    </Box>
                  </Box>

                  <Typography variant="body2" textAlign="center" color="text.secondary">
                    OR
                  </Typography>

                  {/* Create New Session */}
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={!name.trim() || !isConnected || isJoining}
                    onClick={handleCreateSession}
                    sx={{ py: 1.5 }}
                  >
                    {isJoining ? 'Creating...' : 'Create New Session'}
                  </Button>

                  {createdSessionId && (
                    <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, textAlign: 'center' }}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>
                        Session Created! Share this ID:
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Typography variant="h6" fontFamily="monospace" sx={{ bgcolor: 'white', px: 2, py: 1, borderRadius: 1 }}>
                          {createdSessionId}
                        </Typography>
                        <Button size="small" onClick={() => copyToClipboard(createdSessionId)}>
                          Copy
                        </Button>
                      </Box>
                    </Box>
                  )}

                  <Typography variant="body2" textAlign="center" color="text.secondary">
                    OR
                  </Typography>

                  {/* Join Existing Session */}
                  <TextField
                    label="Session ID"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    variant="outlined"
                    fullWidth
                    placeholder="Enter session ID to join existing session"
                  />

                  <Button
                    variant="outlined"
                    size="large"
                    fullWidth
                    disabled={!name.trim() || !sessionId.trim() || !isConnected || isJoining}
                    onClick={handleJoinExistingSession}
                    sx={{ py: 1.5 }}
                  >
                    {isJoining ? 'Joining...' : 'Join Existing Session'}
                  </Button>
                </Box>

                {/* Demo Instructions */}
                <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    How to join the same meeting:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Method 1 - Demo Sessions:</strong><br />
                    • Both doctor & patient click the same demo session button (e.g., DEMO-001)<br />
                    <strong>Method 2 - Custom Session:</strong><br />
                    • One person creates a new session and shares the Session ID<br />
                    • Other person enters that Session ID in "Join Existing Session"<br />
                    <strong>Method 3 - Manual:</strong><br />
                    • Both enter the same Session ID (e.g., "MEETING-123")
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default LandingPage;
