# WebRTC P2P Audio (Manual Signaling)

A single-page app to stream microphone audio peer-to-peer between two devices using WebRTC, without any backend. Signaling is done via copy/paste codes.

## How it works

- The page uses STUN servers only for NAT traversal. There is no TURN relay.
- One device creates an Offer Code and sends it to the other device through any channel (IM, QR, etc.).
- The other device creates an Answer Code and sends it back.
- Each code contains the SDP offer/answer with ICE candidates embedded (non-trickle), so no continuous signaling is required.

## Quick start (local test on one device)

1. Serve the folder locally (e.g., `python3 -m http.server 8000` from this directory).
2. Open `http://localhost:8000/webrtc-p2p/` in your browser.
3. In the left panel, click "Start mic and create Offer Code" and allow mic.
4. Copy the Offer Code.
5. In the right panel, paste the Offer Code, click "Create Answer Code" and allow mic.
6. Copy the Answer Code.
7. Paste the Answer Code back into the left panel and click "Apply Answer Code and Connect".

You should see the connection state change to Connected and hear remote audio (loopback between tabs works for testing, though echo cancellation can interfere).

## Using across two devices (no server signaling)

- Open the same page on both devices (you can host locally and access via LAN). Due to browser security, microphone access typically requires HTTPS except on `localhost`. If you access the page via `http://<LAN-IP>:8000`, some browsers (e.g., Chrome on Android/iOS Safari) will block mic access.
- Options:
  - Use HTTPS locally (e.g., via Caddy, mkcert, or another HTTPS static server).
  - Alternatively, run the static server on each device and access via `localhost` on each device, then exchange codes through any channel.

## Limitations

- No TURN server: in restrictive NAT environments, peers may fail to connect.
- Manual signaling: you must copy/paste the codes yourself.
- Audio only.

## Troubleshooting

- If you see "Microphone permission denied": ensure the origin is secure (HTTPS or localhost) and that your browser has mic permission.
- If connection gets stuck at `checking` or `failed`: your networks may not allow direct connectivity without TURN.
- If no audio: check system volume, OS input/output devices, and that the `Remote Audio` element is not muted.

## Privacy

- No data is sent to any backend by this page.
- Audio is end-to-end between the two browsers once connected.