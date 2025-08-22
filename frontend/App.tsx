import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View, FlatList } from 'react-native';
import { createRoom, getRoom, listRooms } from './src/api';
import { createSocket, getLocalAudioStream, createPeerConnection } from './src/signaling';
import { MediaStream, RTCIceCandidate, RTCSessionDescription, RTCPeerConnection } from './src/webrtc';
import { monitorStreamLevel, monitorAudioElementLevel, monitorSenderOutboundAudioLevel } from './src/audioLevel';

export default function App() {
	const [roomId, setRoomId] = useState<string>('');
	const [availableRooms, setAvailableRooms] = useState<Array<{ id: string; createdAt: string; participants: number }>>([]);
	const [status, setStatus] = useState<string>('Idle');
	const [inRoom, setInRoom] = useState<boolean>(false);
	const [localLevel, setLocalLevel] = useState<number>(0);
	const [chatInput, setChatInput] = useState<string>('');
	const [chatMessages, setChatMessages] = useState<Array<{ from: string; text: string; ts: number }>>([]);
	const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);
	const localStreamRef = useRef<MediaStream | null>(null);
	const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
	const remoteAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
	const remoteLevelStopFnsRef = useRef<Map<string, () => void>>(new Map());
	const localLevelStopFnRef = useRef<null | (() => void)>(null);
	const levelPcRef = useRef<RTCPeerConnection | null>(null);
	const pendingIceRef = useRef<Map<string, any[]>>(new Map());

	useEffect(() => {
		refreshRooms();
	}, []);

	// Web-only: ensure remote audio elements are unmuted and played after a user gesture
	useEffect(() => {
		if (typeof document === 'undefined') return;
		const resume = () => {
			remoteAudioElsRef.current.forEach((el) => {
				try { (el as any).muted = false; } catch { }
				try { (el as any).play?.(); } catch { }
			});
		};
		document.addEventListener('click', resume, { once: true } as any);
		document.addEventListener('touchend', resume, { once: true } as any);
		return () => {
			try { document.removeEventListener('click', resume as any); } catch { }
			try { document.removeEventListener('touchend', resume as any); } catch { }
		};
	}, [inRoom]);

	async function refreshRooms() {
		try {
			const rooms = await listRooms();
			setAvailableRooms(rooms);
		} catch (e: any) {
			setStatus(`Failed to load rooms: ${e.message}`);
		}
	}

	async function handleCreateRoom() {
		setStatus('Creating room...');
		try {
			const created = await createRoom();
			setRoomId(created.id);
			setStatus(`Room created: ${created.id}`);
			await joinRoom(created.id);
		} catch (e: any) {
			setStatus(`Error: ${e.message}`);
		}
	}

	async function handleJoinRoom() {
		if (!roomId) {
			setStatus('Enter a room id first');
			return;
		}
		await joinRoom(roomId);
	}

	async function joinRoom(joinId: string) {
		try {
			await getRoom(joinId);
		} catch (e: any) {
			setStatus(`Room not found: ${e.message}`);
			return;
		}

		setStatus('Requesting microphone and connecting...');
		try {
			localStreamRef.current = await getLocalAudioStream();
			// Start local mic level monitor: use WebAudio on web, getStats on native
			if (localLevelStopFnRef.current) {
				try { localLevelStopFnRef.current(); } catch { }
			}
			if (typeof document !== 'undefined') {
				localLevelStopFnRef.current = monitorStreamLevel(localStreamRef.current as any, setLocalLevel);
			}
			// On native (Android/iOS), use a single temporary local PC (no transceivers)
			// to expose a sender and gather stats, even when alone in the room.
			if (typeof document === 'undefined') {
				try {
					const meterPc = createPeerConnection(() => { });
					levelPcRef.current = meterPc as any;
					localStreamRef.current?.getTracks().forEach((track: any) => {
						(meterPc as any).addTrack(track as any, localStreamRef.current as any);
					});
					try {
						const offer = await (meterPc as any).createOffer();
						await (meterPc as any).setLocalDescription(offer);
					} catch { }
					localLevelStopFnRef.current = monitorSenderOutboundAudioLevel(meterPc as any, setLocalLevel);
				} catch { }
			}
		} catch (e: any) {
			setStatus(`Microphone error: ${e.message ?? e}`);
			return;
		}

		const socket = createSocket();
		socketRef.current = socket;

		function ensurePeer(remoteSocketId: string) {
			let pc = peerConnectionsRef.current.get(remoteSocketId);
			if (!pc) {
				pc = createPeerConnection((stream) => {
					// On web, attach stream to a hidden audio element
					if (typeof document !== 'undefined') {
						let audioEl = remoteAudioElsRef.current.get(remoteSocketId);
						if (!audioEl) {
							audioEl = document.createElement('audio');
							audioEl.autoplay = true;
							(audioEl as any).playsInline = true;
							// Be generous with autoplay policies
							(audioEl as any).muted = false;
							(audioEl as any).defaultMuted = false;
							(audioEl as any).setAttribute?.('autoplay', '');
							(audioEl as any).setAttribute?.('playsinline', '');
							audioEl.style.display = 'none';
							remoteAudioElsRef.current.set(remoteSocketId, audioEl);
							document.body.appendChild(audioEl);
						}
						(audioEl as any).srcObject = stream as any;
						try { (audioEl as any).play?.(); } catch { }
						// Start remote level monitor for this peer
						const prevStop = remoteLevelStopFnsRef.current.get(remoteSocketId);
						if (prevStop) { try { prevStop(); } catch { } }
						const stopFn = monitorAudioElementLevel(audioEl!, (lvl) => {
							const el: any = remoteAudioElsRef.current.get(remoteSocketId);
							if (el) {
								el.__level = lvl;
							}
						});
						remoteLevelStopFnsRef.current.set(remoteSocketId, stopFn);
					}
				});
				// Ensure we have an audio transceiver on web only (avoid native crashes)
				if (typeof document !== 'undefined') {
					try { (pc as any).addTransceiver?.('audio', { direction: 'sendrecv' }); } catch { }
				}
				// Attach local audio
				localStreamRef.current?.getTracks().forEach((track: any) => {
					try { (track as any).contentHint = 'speech'; } catch { }
					(pc as any)!.addTrack(track as any, localStreamRef.current as any)
				});
				// Native-only compatibility: also add the full stream (some Android devices need this)
				if (typeof document === 'undefined' && localStreamRef.current) {
					try { (pc as any).addStream?.(localStreamRef.current as any); } catch { }
				}
				// On native, drive mic level from sender stats
				if (typeof document === 'undefined') {
					if (localLevelStopFnRef.current) { try { localLevelStopFnRef.current(); } catch { } }
					// Close any temporary metering PC now that we have a real PC
					if (levelPcRef.current) { try { (levelPcRef.current as any).close(); } catch { } levelPcRef.current = null; }
					localLevelStopFnRef.current = monitorSenderOutboundAudioLevel(pc as any, setLocalLevel);
				}

				(pc as any).onicecandidate = (event: any) => {
					if (event.candidate) {
						socket.emit('ice-candidate', { targetSocketId: remoteSocketId, candidate: event.candidate });
					}
				};

				peerConnectionsRef.current.set(remoteSocketId, pc!);
			}
			return pc!;
		}

		socket.on('connect', () => {
			setStatus('Connected to signaling');
			socket.emit('join-room', { roomId: joinId });
			setInRoom(true);
		});

		socket.on('join-error', ({ message }) => {
			setStatus(`Join error: ${message}`);
		});

		socket.on('room-users', async ({ existingParticipantSocketIds }) => {
			setStatus(`Joined room. Peers: ${existingParticipantSocketIds.length}`);
			for (const remoteSocketId of existingParticipantSocketIds as string[]) {
				const pc = ensurePeer(remoteSocketId)!;
				const offer = await (pc as any).createOffer(
					typeof document !== 'undefined' ? ({ offerToReceiveAudio: true } as any) : (undefined as any)
				);
				await (pc as any).setLocalDescription(offer);
				socket.emit('offer', { targetSocketId: remoteSocketId, offer });
			}
		});

		socket.on('user-joined', async ({ socketId }) => {
			setStatus(`User joined: ${socketId}`);
			// Avoid glare: do not create an offer here. The new participant will offer.
			ensurePeer(socketId);
		});

		socket.on('offer', async ({ fromSocketId, offer }) => {
			const pc = ensurePeer(fromSocketId)!;
			await (pc as any).setRemoteDescription(offer as any);
			// Flush any queued ICE candidates now that we have a remote description
			const queued = pendingIceRef.current.get(fromSocketId) || [];
			for (const c of queued) {
				try { await (pc as any).addIceCandidate(c as any); } catch { }
			}
			pendingIceRef.current.delete(fromSocketId);
			const answer = await (pc as any).createAnswer();
			await (pc as any).setLocalDescription(answer);
			socket.emit('answer', { targetSocketId: fromSocketId, answer });
		});

		socket.on('answer', async ({ fromSocketId, answer }) => {
			const pc = ensurePeer(fromSocketId)!;
			await (pc as any).setRemoteDescription(answer as any);
			// Flush any queued ICE candidates after remote description is set
			const queued = pendingIceRef.current.get(fromSocketId) || [];
			for (const c of queued) {
				try { await (pc as any).addIceCandidate(c as any); } catch { }
			}
			pendingIceRef.current.delete(fromSocketId);
		});

		socket.on('ice-candidate', async ({ fromSocketId, candidate }) => {
			const pc = ensurePeer(fromSocketId)!;
			// If remote description isn't set yet, queue the candidate
			if (!(pc as any).remoteDescription) {
				const q = pendingIceRef.current.get(fromSocketId) || [];
				q.push(candidate);
				pendingIceRef.current.set(fromSocketId, q);
				return;
			}
			try {
				await (pc as any).addIceCandidate(candidate as any);
			} catch { }
		});

		socket.on('user-left', ({ socketId }) => {
			const pc = peerConnectionsRef.current.get(socketId);
			pc?.close();
			peerConnectionsRef.current.delete(socketId);
			// Remove any audio element and stop level monitor
			if (typeof document !== 'undefined') {
				const audioEl = remoteAudioElsRef.current.get(socketId);
				if (audioEl) {
					try { document.body.removeChild(audioEl); } catch { }
					remoteAudioElsRef.current.delete(socketId);
				}
			}
			const stop = remoteLevelStopFnsRef.current.get(socketId);
			if (stop) { try { stop(); } catch { } }
			remoteLevelStopFnsRef.current.delete(socketId);
		});

		// Chat
		socket.on('chat-message', ({ fromSocketId, text, ts }) => {
			setChatMessages((msgs) => [...msgs, { from: fromSocketId, text, ts }]);
		});
	}

	function sendChat() {
		const text = chatInput.trim();
		if (!text) return;
		setChatInput('');
		try {
			socketRef.current?.emit('chat-message', { roomId, text });
			setChatMessages((msgs) => [...msgs, { from: 'me', text, ts: Date.now() }]);
		} catch { }
	}

	function cleanup() {
		peerConnectionsRef.current.forEach((pc) => (pc as any).close());
		peerConnectionsRef.current.clear();
		if (levelPcRef.current) { try { (levelPcRef.current as any).close(); } catch { } levelPcRef.current = null; }
		if (socketRef.current) {
			try {
				// Best-effort notify server so it updates room state immediately
				socketRef.current.emit('leave-room', { roomId });
			} catch { }
			socketRef.current.disconnect();
			socketRef.current = null;
		}
		localStreamRef.current?.getTracks().forEach((t: any) => t.stop());
		localStreamRef.current = null;
		if (localLevelStopFnRef.current) {
			try { localLevelStopFnRef.current(); } catch { }
			localLevelStopFnRef.current = null;
		}
		// Remove audio els and stop remote monitors
		if (typeof document !== 'undefined') {
			remoteAudioElsRef.current.forEach((el) => {
				try { document.body.removeChild(el); } catch { }
			});
			remoteAudioElsRef.current.clear();
		}
		remoteLevelStopFnsRef.current.forEach((stop) => { try { stop(); } catch { } });
		remoteLevelStopFnsRef.current.clear();
		setChatMessages([]);
		setInRoom(false);
		setStatus('Left room');
	}

	return (
		<View style={styles.container}>
			{!inRoom ? (
				<View style={{ width: '100%' }}>
					<Text style={styles.title}>Voice Chat (Socket.IO + WebRTC)</Text>
					<TextInput
						style={styles.input}
						placeholder="Room ID"
						value={roomId}
						onChangeText={setRoomId}
					/>
					<View style={styles.row}>
						<Button title="Create Room" onPress={handleCreateRoom} />
						<View style={{ width: 12 }} />
						<Button title="Join Room" onPress={handleJoinRoom} />
					</View>
					<Text style={styles.status}>{status}</Text>
					<Button title="Refresh Rooms" onPress={refreshRooms} />
					<FlatList
						style={{ marginTop: 12, width: '100%' }}
						data={availableRooms}
						keyExtractor={(item) => item.id}
						renderItem={({ item }) => (
							<View style={styles.roomItem}>
								<Text style={{ flex: 1 }}>{item.id}</Text>
								<Text>{item.participants}/2</Text>
								<View style={{ width: 8 }} />
								<Button title="Use" onPress={() => setRoomId(item.id)} />
							</View>
						)}
					/>
				</View>
			) : (
				<View style={{ width: '100%', gap: 12 }}>
					<Text style={styles.title}>Room {roomId}</Text>
					<View style={styles.row}>
						<Button title="Leave" onPress={cleanup} />
						<View style={{ width: 12 }} />
						<Text style={styles.status}>{status}</Text>
					</View>
					<View>
						<Text>Your mic level</Text>
						<View style={{ height: 10, backgroundColor: '#eee', borderRadius: 6, overflow: 'hidden' }}>
							<View style={{ height: '100%', width: `${Math.round(localLevel * 100)}%`, backgroundColor: localLevel > 0.6 ? '#e74c3c' : localLevel > 0.3 ? '#f1c40f' : '#2ecc71' }} />
						</View>
					</View>
					<View>
						<Text>Remote audio levels</Text>
						<FlatList
							data={Array.from(peerConnectionsRef.current.keys())}
							keyExtractor={(k) => k}
							renderItem={({ item }) => {
								const audioEl = remoteAudioElsRef.current.get(item) as any;
								const level = (audioEl && audioEl.__level) || 0;
								return (
									<View style={{ marginVertical: 6 }}>
										<Text numberOfLines={1} style={{ fontSize: 12, color: '#555' }}>{item}</Text>
										<View style={{ height: 8, backgroundColor: '#eee', borderRadius: 6, overflow: 'hidden' }}>
											<View style={{ height: '100%', width: `${Math.round(level * 100)}%`, backgroundColor: level > 0.6 ? '#e74c3c' : level > 0.3 ? '#f1c40f' : '#2ecc71' }} />
										</View>
									</View>
								);
							}}
						/>
					</View>
					<View style={{ borderTopColor: '#eee', borderTopWidth: 1, paddingTop: 8 }}>
						<Text style={{ fontWeight: '600' }}>Chat</Text>
						<FlatList
							style={{ height: 200, marginVertical: 8 }}
							data={chatMessages}
							keyExtractor={(m, idx) => String(m.ts) + '-' + idx}
							renderItem={({ item }) => (
								<Text>
									{item.from === 'me' ? 'You' : item.from}: {item.text}
								</Text>
							)}
						/>
						<View style={styles.row}>
							<TextInput style={[styles.input, { flex: 1 }]} placeholder="Type a message" value={chatInput} onChangeText={setChatInput} />
							<View style={{ width: 8 }} />
							<Button title="Send" onPress={sendChat} />
						</View>
					</View>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
		alignItems: 'center',
		justifyContent: 'flex-start',
		paddingTop: 80,
		paddingHorizontal: 16,
		gap: 12,
		width: '100%',
	},
	title: { fontSize: 20, fontWeight: '600' },
	input: {
		borderWidth: 1,
		borderColor: '#ccc',
		borderRadius: 6,
		padding: 10,
		width: '100%',
	},
	row: { flexDirection: 'row', alignItems: 'center' },
	status: { marginVertical: 8 },
	roomItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 8,
		borderBottomColor: '#eee',
		borderBottomWidth: 1,
	},
});
