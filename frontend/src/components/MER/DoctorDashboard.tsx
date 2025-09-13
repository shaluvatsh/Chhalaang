import React from 'react';
import { Box, Typography } from '@mui/material';

interface DoctorDashboardProps {
  user: { name: string; role: 'doctor' | 'patient' };
  sessionId: string;
}

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ user, sessionId }) => {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4">
        Doctor Dashboard - {user.name}
      </Typography>
      <Typography variant="body1">
        Session: {sessionId}
      </Typography>
      <Typography variant="body2" sx={{ mt: 2 }}>
        MER generation and management interface coming soon...
      </Typography>
    </Box>
  );
};

export default DoctorDashboard;
