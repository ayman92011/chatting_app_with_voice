import { Controller, Get, Param, Post } from '@nestjs/common';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
	constructor(private readonly roomsService: RoomsService) {}

	@Post()
	create() {
		const room = this.roomsService.createRoom();
		return { id: room.id, createdAt: room.createdAt };
	}

	@Get()
	list() {
		return this.roomsService.listRooms();
	}

	@Get(':id')
	get(@Param('id') id: string) {
		const room = this.roomsService.getRoom(id);
		return {
			id: room.id,
			createdAt: room.createdAt,
			participants: room.participantSocketIds.size,
		};
	}
}