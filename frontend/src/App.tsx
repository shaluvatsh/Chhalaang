import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Components
import LandingPage from './components/LandingPage';
import VideoCall from './components/VideoCall/VideoCall';
import DoctorDashboard from './components/MER/DoctorDashboard';
import TranscriptionView from './components/Transcription/TranscriptionView';

// Services
import socketService from './services/socketService';

// Theme configuration
const theme = createTheme({
  palette: {
    primary: {
      main: '#667eea',
      light: '#9bb5ff',
      dark: '#3f51b7'
    },
    secondary: {
      main: '#764ba2',
      light: '#a479d9',
      dark: '#4a2c73'
    },
    background: {
      default: '#f5f7fa',
      paper: '#ffffff'
    }
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600
    },
    h5: {
      fontWeight: 500
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }
      }
    }
  }
});

const App: React.FC = () => {
  const [user, setUser] = useState<{
    name: string;
    role: 'doctor' | 'patient';
  } | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    // Initialize socket connection
    socketService.connect();
    
    // Listen for connection status
    socketService.on('connect', () => {
      setIsConnected(true);
      console.log('✅ Connected to server');
    });
    
    socketService.on('disconnect', () => {
      setIsConnected(false);
      console.log('❌ Disconnected from server');
    });
    
    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleJoinSession = (userData: { name: string; role: 'doctor' | 'patient' }, sessionId: string) => {
    setUser(userData);
    setSessionId(sessionId);
    
    // Join the session via socket
    socketService.emit('join-session', {
      sessionId,
      userRole: userData.role,
      userName: userData.name
    });
  };

  const handleLeaveSession = () => {
    setUser(null);
    setSessionId('');
    // Socket will handle disconnect automatically
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <div className="App">
          <Routes>
            {/* Landing Page - Entry point */}
            <Route 
              path="/" 
              element={
                user ? (
                  <Navigate to={`/session/${sessionId}`} replace />
                ) : (
                  <LandingPage 
                    onJoinSession={handleJoinSession}
                    isConnected={isConnected}
                  />
                )
              } 
            />
            
            {/* Video Call Session */}
            <Route 
              path="/session/:sessionId" 
              element={
                user ? (
                  <VideoCall 
                    user={user}
                    sessionId={sessionId}
                    onLeaveSession={handleLeaveSession}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              } 
            />
            
            {/* Doctor Dashboard - MER Management */}
            <Route 
              path="/dashboard" 
              element={
                user?.role === 'doctor' ? (
                  <DoctorDashboard 
                    user={user}
                    sessionId={sessionId}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              } 
            />
            
            {/* Transcription View */}
            <Route 
              path="/transcription/:sessionId" 
              element={
                user ? (
                  <TranscriptionView 
                    user={user}
                    sessionId={sessionId}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              } 
            />
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
      
      {/* Toast notifications */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </ThemeProvider>
  );
};

export default App;
