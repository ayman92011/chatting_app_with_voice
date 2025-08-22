// Minimal web shim for browser use when building for web
export const RTCPeerConnection = (window as any).RTCPeerConnection;
export const RTCIceCandidate = (window as any).RTCIceCandidate;
export const RTCSessionDescription = (window as any).RTCSessionDescription;

export const mediaDevices = navigator.mediaDevices;

export type MediaStream = globalThis.MediaStream;