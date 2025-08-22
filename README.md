# Voice Chat App (Socket.IO + NestJS + React Native Expo 52)

This repository contains a minimal 1:1 voice chat app using Socket.IO for signaling and WebRTC for audio.

- Backend: NestJS (REST + Socket.IO)
- Frontend: React Native (Expo 52), `react-native-webrtc`

## Project Structure

- `backend/`: NestJS app
- `frontend/`: Expo app

## Prerequisites

- Node.js 18+
- Android Studio or Xcode (for device/simulator)
- For Android on Linux: an emulator or a physical device with USB debugging

## Backend

### Install & Run

```bash
cd backend
npm i
npm run start:dev
```

- REST base URL: `http://localhost:3000`
- Socket.IO URL: `http://localhost:3000`

### REST Endpoints

- `POST /rooms` → create room
- `GET /rooms` → list rooms
- `GET /rooms/:id` → room info

Rooms are kept in-memory and automatically removed when all participants leave.

### Socket.IO Events

Client → Server:
- `join-room` { roomId }
- `leave-room` { roomId }
- `offer` { targetSocketId, offer }
- `answer` { targetSocketId, answer }
- `ice-candidate` { targetSocketId, candidate }

Server → Client:
- `room-users` { existingParticipantSocketIds }
- `user-joined` { socketId }
- `user-left` { socketId }
- `offer` { fromSocketId, offer }
- `answer` { fromSocketId, answer }
- `ice-candidate` { fromSocketId, candidate }
- `join-error` { message }

## Frontend (Expo 52)

### Install & Run

```bash
cd frontend
npm i
# Set your backend URL. For Android emulator, use http://10.0.2.2:3000
export EXPO_PUBLIC_BACKEND_URL=http://localhost:3000
npm run start
```

Then launch the app on your device/simulator:

```bash
# Android
npm run android
# iOS (on macOS)
npm run ios
```

### Permissions

- iOS: Microphone usage description set in `app.json`.
- Android: RECORD_AUDIO permission set in `app.json`.

### Features

- Create a room using `POST /rooms`.
- Join a room by entering the room ID and tapping Join.
- Simple 1:1 signaling via Socket.IO with WebRTC audio.

### Notes

- For Android emulator use `http://10.0.2.2:3000` as the backend URL.
- For a physical device on the same LAN, set `EXPO_PUBLIC_BACKEND_URL` to your machine IP, e.g. `http://192.168.1.100:3000`.
- This demo uses public STUN servers. For production reliability, configure TURN.

## Development Tips

- Backend code:
  - Rooms service/controller: `backend/src/rooms/*`
  - Signaling gateway: `backend/src/signaling/signaling.gateway.ts`
- Frontend code:
  - API helpers: `frontend/src/api.ts`
  - Socket/WebRTC helpers: `frontend/src/signaling.ts`
  - App UI: `frontend/App.tsx`