# AI Voice MER App - Setup Guide

## Overview
Real-time Medical Encounter Records with AI transcription for telehealth consultations.

## Architecture
- **Backend**: Node.js + Express + Socket.IO
- **Frontend**: React + TypeScript + Material-UI
- **AI Services**: OpenAI GPT-4 + Whisper, Deepgram, AssemblyAI
- **Database**: PostgreSQL
- **Real-time**: WebRTC + WebSockets

## Quick Start

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment variables
copy .env.example .env

# Edit .env file with your API keys:
# - OPENAI_API_KEY=your_key_here
# - DEEPGRAM_API_KEY=your_key_here (optional)
# - ASSEMBLYAI_API_KEY=your_key_here (optional)

# Start development server
npm run dev
```

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

### 3. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

## Environment Variables

### Required for Backend (.env):
```
# API Keys (at least OpenAI required)
OPENAI_API_KEY=your_openai_api_key_here
DEEPGRAM_API_KEY=your_deepgram_api_key_here
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mer_database
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_here
```

## Features Implemented

### ✅ Backend Core
- [x] Express server with Socket.IO
- [x] Real-time transcription service (OpenAI/Deepgram/AssemblyAI)
- [x] MER generator with SOAP notes, ICD-10 codes, prescriptions
- [x] WebSocket handlers for video calls
- [x] API routes for transcription and MER generation

### ✅ Frontend Core
- [x] React app with TypeScript
- [x] Material-UI components
- [x] Landing page with role selection
- [x] Video call interface with WebRTC ready
- [x] Socket.IO integration
- [x] Placeholder components for dashboard and transcription

### 🔄 In Progress
- [ ] WebRTC peer-to-peer connection implementation
- [ ] Real-time audio stream processing
- [ ] Database models and persistence
- [ ] Doctor dashboard with MER management

## Demo Flow

1. **Landing Page**: Choose role (Doctor/Patient) and create/join session
2. **Video Call**: WebRTC video with live transcription
3. **Recording**: Doctor starts/stops recording for transcription
4. **Transcription**: Real-time speech-to-text with speaker diarization
5. **MER Generation**: AI creates SOAP notes, ICD codes, and prescriptions
6. **Dashboard**: Doctor reviews and edits generated medical records

## API Endpoints

### Transcription
- `GET /api/transcription/status` - Service status
- `POST /api/transcription/provider` - Switch provider
- `POST /api/transcription/test` - Test transcription

### MER Generation
- `POST /api/mer/generate` - Generate complete MER
- `POST /api/mer/soap` - Generate SOAP notes only
- `POST /api/mer/icd-codes` - Generate ICD-10 codes
- `POST /api/mer/prescriptions` - Generate prescriptions

## WebSocket Events

### Client → Server
- `join-session` - Join a video session
- `start-recording` - Start transcription recording
- `stop-recording` - Stop recording and generate MER
- `audio-stream` - Send audio chunk for transcription

### Server → Client
- `user-joined` - Another user joined session
- `live-transcription` - Real-time transcript entry
- `mer-generated` - Generated MER document
- `recording-started/stopped` - Recording status updates

## Next Steps for Full Implementation

1. **Install and configure PostgreSQL**
2. **Set up database models** with Sequelize
3. **Implement WebRTC signaling** for actual peer connections
4. **Add real-time audio streaming** for transcription
5. **Complete doctor dashboard** with MER editing capabilities
6. **Add authentication** and user management
7. **Deploy** to cloud platform

## Development Commands

### Backend
```bash
npm run dev      # Start with nodemon
npm start        # Start production
npm test         # Run tests
```

### Frontend
```bash
npm start        # Start development server
npm run build    # Build for production
npm test         # Run tests
```

## Troubleshooting

1. **CORS Issues**: Check CORS_ORIGINS in .env
2. **API Keys**: Ensure OpenAI API key is valid
3. **WebSocket**: Check firewall settings for Socket.IO
4. **Media Access**: Allow camera/microphone permissions in browser
5. **Dependencies**: Run `npm install` in both directories

## Tech Stack Details

- **Node.js** - Runtime environment
- **Express** - Web framework
- **Socket.IO** - Real-time bidirectional communication
- **React 18** - Frontend framework
- **TypeScript** - Type safety
- **Material-UI v5** - UI components
- **OpenAI API** - GPT-4 for MER generation, Whisper for transcription
- **WebRTC** - Peer-to-peer video/audio
- **PostgreSQL** - Database for medical records
