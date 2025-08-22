import io, { Socket } from "socket.io-client";
import { Platform, PermissionsAndroid } from "react-native";
import { BACKEND_URL } from "./constants";
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from "./webrtc.native";

export type PeerConnections = Map<string, RTCPeerConnection>;

export interface SignalingHandlers {
  onRoomUsers: (socketIds: string[]) => void;
  onUserJoined: (socketId: string) => void;
  onUserLeft: (socketId: string) => void;
  onOffer: (fromSocketId: string, offer: any) => void;
  onAnswer: (fromSocketId: string, answer: any) => void;
  onIceCandidate: (fromSocketId: string, candidate: any) => void;
  onJoinError: (message: string) => void;
}

export function createSocket(): Socket {
  const socket = io(BACKEND_URL, {
    transports: ["websocket"],
    reconnection: true,
    forceNew: true,
  });
  return socket;
}

export async function getLocalAudioStream(): Promise<MediaStream> {
  // On Android, request runtime mic permission if needed
  if (Platform.OS === "android") {
    const has = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    if (!has) {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (res !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error("Microphone permission denied");
      }
    }
  }
  const stream = await mediaDevices.getUserMedia({
    audio: true,
    video: false,
  } as any);
  return stream as any;
}

export function createPeerConnection(
  onRemoteStream: (stream: MediaStream) => void
) {
  const pc: any = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478?transport=udp" },
    ],
  } as any);
  pc.ontrack = (event: any) => {
    const [stream] = event.streams;
    if (stream) {
      onRemoteStream(stream);
    }
  };
  return pc as any;
}
