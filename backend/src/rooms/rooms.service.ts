import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface RoomInfo {
	id: string;
	createdAt: Date;
	participantSocketIds: Set<string>;
}

@Injectable()
export class RoomsService {
	private rooms: Map<string, RoomInfo> = new Map();
	private readonly maxParticipantsPerRoom = 2;

	createRoom(): RoomInfo {
		const id = uuidv4();
		const room: RoomInfo = {
			id,
			createdAt: new Date(),
			participantSocketIds: new Set(),
		};
		this.rooms.set(id, room);
		return room;
	}

	listRooms(): Array<{ id: string; createdAt: Date; participants: number }> {
		return Array.from(this.rooms.values()).map((r) => ({
			id: r.id,
			createdAt: r.createdAt,
			participants: r.participantSocketIds.size,
		}));
	}

	getRoom(id: string): RoomInfo {
		const room = this.rooms.get(id);
		if (!room) {
			throw new NotFoundException('Room not found');
		}
		return room;
	}

	addParticipant(roomId: string, socketId: string): { existingParticipantIds: string[] } {
		const room = this.getRoom(roomId);
		if (room.participantSocketIds.size >= this.maxParticipantsPerRoom) {
			throw new BadRequestException('Room is full');
		}
		room.participantSocketIds.add(socketId);
		const others = Array.from(room.participantSocketIds).filter((id) => id !== socketId);
		return { existingParticipantIds: others };
	}

	removeParticipant(roomId: string, socketId: string): void {
		const room = this.rooms.get(roomId);
		if (!room) return;
		room.participantSocketIds.delete(socketId);
		if (room.participantSocketIds.size === 0) {
			this.rooms.delete(roomId);
		}
	}
}