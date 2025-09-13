import React from 'react';
import { Box, Typography } from '@mui/material';

interface TranscriptionViewProps {
  user: { name: string; role: 'doctor' | 'patient' };
  sessionId: string;
}

const TranscriptionView: React.FC<TranscriptionViewProps> = ({ user, sessionId }) => {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4">
        Transcription View - {user.name}
      </Typography>
      <Typography variant="body1">
        Session: {sessionId}
      </Typography>
      <Typography variant="body2" sx={{ mt: 2 }}>
        Dedicated transcription interface coming soon...
      </Typography>
    </Box>
  );
};

export default TranscriptionView;
