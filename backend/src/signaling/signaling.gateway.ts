import {
	WebSocketGateway,
	WebSocketServer,
	SubscribeMessage,
	MessageBody,
	ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomsService } from '../rooms/rooms.service';

@WebSocketGateway({
	cors: { origin: true, credentials: true },
})
export class SignalingGateway {
	@WebSocketServer()
	server: Server;

	constructor(private readonly roomsService: RoomsService) {}

	@SubscribeMessage('join-room')
	handleJoin(
		@MessageBody() data: { roomId: string; userId?: string },
		@ConnectedSocket() client: Socket,
	) {
		const { roomId } = data;
		try {
			const { existingParticipantIds } = this.roomsService.addParticipant(roomId, client.id);
			client.join(roomId);
			client.emit('room-users', { existingParticipantSocketIds: existingParticipantIds });
			client.to(roomId).emit('user-joined', { socketId: client.id });
		} catch (err: any) {
			client.emit('join-error', { message: err.message ?? 'Join failed' });
		}
	}

	@SubscribeMessage('leave-room')
	handleLeave(
		@MessageBody() data: { roomId: string },
		@ConnectedSocket() client: Socket,
	) {
		const { roomId } = data;
		client.leave(roomId);
		this.roomsService.removeParticipant(roomId, client.id);
		client.to(roomId).emit('user-left', { socketId: client.id });
	}

	@SubscribeMessage('offer')
	handleOffer(
		@MessageBody() data: { targetSocketId: string; offer: any },
		@ConnectedSocket() client: Socket,
	) {
		this.server.to(data.targetSocketId).emit('offer', { fromSocketId: client.id, offer: data.offer });
	}

	@SubscribeMessage('answer')
	handleAnswer(
		@MessageBody() data: { targetSocketId: string; answer: any },
		@ConnectedSocket() client: Socket,
	) {
		this.server.to(data.targetSocketId).emit('answer', { fromSocketId: client.id, answer: data.answer });
	}

	@SubscribeMessage('ice-candidate')
	handleIceCandidate(
		@MessageBody() data: { targetSocketId: string; candidate: any },
		@ConnectedSocket() client: Socket,
	) {
		this.server
			.to(data.targetSocketId)
			.emit('ice-candidate', { fromSocketId: client.id, candidate: data.candidate });
	}
}