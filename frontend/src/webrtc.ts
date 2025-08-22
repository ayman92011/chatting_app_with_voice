// Type resolution shim for TypeScript. At runtime, Metro will pick
// platform-specific files (e.g., webrtc.web.ts for web). For type checking,
// re-export the native typings which share the same surface.
export {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from "./webrtc.native";
