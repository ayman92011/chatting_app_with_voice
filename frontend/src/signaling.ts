import io, { Socket } from "socket.io-client";
import { Platform, PermissionsAndroid } from "react-native";
import { BACKEND_URL } from "./constants";
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from "./webrtc";

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
  // On Android, request runtime mic permission (and Bluetooth for API 31+ for some headsets)
  if (Platform.OS === "android") {
    const hasMic = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    let micGranted = hasMic;
    if (!hasMic) {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      micGranted = res === PermissionsAndroid.RESULTS.GRANTED;
    }
    if (!micGranted) {
      throw new Error("Microphone permission denied");
    }
    // Best-effort ask for BLUETOOTH_CONNECT on Android 12+ to allow routing to BT headsets
    try {
      const version = (Platform as any).Version as number | string | undefined;
      const apiLevel =
        typeof version === "number"
          ? version
          : parseInt(String(version || 0), 10);
      if (!Number.isNaN(apiLevel) && apiLevel >= 31) {
        const hasBt = await PermissionsAndroid.check(
          (PermissionsAndroid as any).PERMISSIONS?.BLUETOOTH_CONNECT ||
            "android.permission.BLUETOOTH_CONNECT"
        );
        if (!hasBt) {
          await PermissionsAndroid.request(
            (PermissionsAndroid as any).PERMISSIONS?.BLUETOOTH_CONNECT ||
              "android.permission.BLUETOOTH_CONNECT"
          );
        }
      }
    } catch {}
  }

  // Use simple constraints on native; detailed constraints on web
  const isWeb = Platform.OS === "web";
  const constraints: any = isWeb
    ? {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      }
    : {
        audio: true,
        video: false,
      };

  const stream = await (mediaDevices as any).getUserMedia(constraints);
  // Ensure audio tracks are enabled
  const audioTracks = (stream as any).getAudioTracks?.() || [];
  for (const track of audioTracks) {
    try {
      track.enabled = true;
    } catch {}
  }
  return stream as any;
}

export function createPeerConnection(
  onRemoteStream: (stream: MediaStream) => void
) {
  // Allow optional TURN server configuration via environment variables
  const turnUrl = (process as any).env?.EXPO_PUBLIC_TURN_URL as
    | string
    | undefined;
  const turnUsername = (process as any).env?.EXPO_PUBLIC_TURN_USERNAME as
    | string
    | undefined;
  const turnCredential = (process as any).env?.EXPO_PUBLIC_TURN_CREDENTIAL as
    | string
    | undefined;
  const forceTurn =
    String((process as any).env?.EXPO_PUBLIC_FORCE_TURN || "").toLowerCase() ===
    "true";

  const iceServers: Array<any> = [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
      ],
    },
  ];
  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  const hasTurn = Boolean(turnUrl && turnUsername && turnCredential);
  const config: any = { iceServers };
  if (forceTurn && hasTurn) {
    (config as any).iceTransportPolicy = "relay";
  }
  // Help some browsers by explicitly opting into Unified Plan on web
  try {
    if (Platform.OS === "web") {
      (config as any).sdpSemantics = "unified-plan";
      (config as any).bundlePolicy = "max-bundle";
    }
  } catch {}
  const pc: any = new RTCPeerConnection(config);
  try {
    if (typeof console !== "undefined")
      console.log("Using ICE servers:", JSON.stringify(config.iceServers));
    if (typeof console !== "undefined" && (config as any).iceTransportPolicy)
      console.log("ICE policy:", (config as any).iceTransportPolicy);
  } catch {}
  pc.ontrack = (event: any) => {
    const [stream] = event.streams;
    if (stream) {
      onRemoteStream(stream);
    }
  };
  // Fallback for older browsers (Safari < 13, some Firefox versions)
  try {
    (pc as any).onaddstream = (event: any) => {
      const stream = event?.stream || event?.streams?.[0];
      if (stream) {
        onRemoteStream(stream);
      }
    };
  } catch {}
  // Helpful diagnostics
  try {
    pc.oniceconnectionstatechange = () => {
      if (typeof console !== "undefined")
        console.log("ICE state:", (pc as any).iceConnectionState);
    };
    pc.onconnectionstatechange = () => {
      if (typeof console !== "undefined")
        console.log("Peer connection state:", (pc as any).connectionState);
    };
    pc.onicegatheringstatechange = () => {
      if (typeof console !== "undefined")
        console.log("ICE gathering:", (pc as any).iceGatheringState);
    };
    (pc as any).onicecandidateerror = (e: any) => {
      if (typeof console !== "undefined")
        console.warn("ICE candidate error:", e);
    };
  } catch {}
  return pc as any;
}
