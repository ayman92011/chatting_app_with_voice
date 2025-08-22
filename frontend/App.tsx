import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View, FlatList } from 'react-native';
import { createRoom, getRoom, listRooms } from './src/api';
import { createSocket, getLocalAudioStream, createPeerConnection } from './src/signaling';
import { MediaStream, RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';

export default function App() {
	const [roomId, setRoomId] = useState<string>('');
	const [availableRooms, setAvailableRooms] = useState<Array<{ id: string; createdAt: string; participants: number }>>([]);
	const [status, setStatus] = useState<string>('Idle');
	const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);
	const localStreamRef = useRef<MediaStream | null>(null);
	const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

	useEffect(() => {
		refreshRooms();
	}, []);

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
		} catch (e: any) {
			setStatus(`Error: ${e.message}`);
		}
	}

	async function handleJoinRoom() {
		if (!roomId) {
			setStatus('Enter a room id first');
			return;
		}
		try {
			await getRoom(roomId);
		} catch (e: any) {
			setStatus(`Room not found: ${e.message}`);
			return;
		}

		setStatus('Requesting microphone and connecting...');
		const socket = createSocket();
		socketRef.current = socket;

		localStreamRef.current = await getLocalAudioStream();

		function ensurePeer(remoteSocketId: string) {
			let pc = peerConnectionsRef.current.get(remoteSocketId);
			if (!pc) {
				pc = createPeerConnection((sid, stream) => {
					// No UI for remote streams in this minimal sample; audio streams auto-play
				});
				// Attach local audio
				localStreamRef.current?.getTracks().forEach((track) => pc!.addTrack(track, localStreamRef.current!));

				pc.onicecandidate = (event) => {
					if (event.candidate) {
						socket.emit('ice-candidate', { targetSocketId: remoteSocketId, candidate: event.candidate });
					}
				};

				pc.ontrack = (event) => {
					// Audio stream will play through default output in RN WebRTC once attached to an element if needed.
				};

				peerConnectionsRef.current.set(remoteSocketId, pc);
			}
			return pc;
		}

		socket.on('connect', () => {
			setStatus('Connected to signaling');
			socket.emit('join-room', { roomId });
		});

		socket.on('join-error', ({ message }) => {
			setStatus(`Join error: ${message}`);
		});

		socket.on('room-users', async ({ existingParticipantSocketIds }) => {
			setStatus(`Joined room. Peers: ${existingParticipantSocketIds.length}`);
			for (const remoteSocketId of existingParticipantSocketIds as string[]) {
				const pc = ensurePeer(remoteSocketId)!;
				const offer = await pc.createOffer();
				await pc.setLocalDescription(offer);
				socket.emit('offer', { targetSocketId: remoteSocketId, offer });
			}
		});

		socket.on('user-joined', async ({ socketId }) => {
			setStatus(`User joined: ${socketId}`);
			const pc = ensurePeer(socketId)!;
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			socket.emit('offer', { targetSocketId: socketId, offer });
		});

		socket.on('offer', async ({ fromSocketId, offer }) => {
			const pc = ensurePeer(fromSocketId)!;
			await pc.setRemoteDescription(new RTCSessionDescription(offer));
			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);
			socket.emit('answer', { targetSocketId: fromSocketId, answer });
		});

		socket.on('answer', async ({ fromSocketId, answer }) => {
			const pc = ensurePeer(fromSocketId)!;
			await pc.setRemoteDescription(new RTCSessionDescription(answer));
		});

		socket.on('ice-candidate', async ({ fromSocketId, candidate }) => {
			const pc = ensurePeer(fromSocketId)!;
			try {
				await pc.addIceCandidate(new RTCIceCandidate(candidate));
			} catch (e) {
				// ignore
			}
		});

		socket.on('user-left', ({ socketId }) => {
			const pc = peerConnectionsRef.current.get(socketId);
			pc?.close();
			peerConnectionsRef.current.delete(socketId);
		});
	}

	function cleanup() {
		peerConnectionsRef.current.forEach((pc) => pc.close());
		peerConnectionsRef.current.clear();
		if (socketRef.current) {
			socketRef.current.disconnect();
			socketRef.current = null;
		}
		localStreamRef.current?.getTracks().forEach((t) => t.stop());
		localStreamRef.current = null;
		setStatus('Left room');
	}

	return (
		<View style={styles.container}>
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
				<View style={{ width: 12 }} />
				<Button title="Leave" onPress={cleanup} />
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
