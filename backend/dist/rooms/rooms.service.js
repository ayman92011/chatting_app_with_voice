"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomsService = void 0;
const common_1 = require("@nestjs/common");
const uuid_1 = require("uuid");
let RoomsService = class RoomsService {
    rooms = new Map();
    maxParticipantsPerRoom = 2;
    createRoom() {
        const id = (0, uuid_1.v4)();
        const room = {
            id,
            createdAt: new Date(),
            participantSocketIds: new Set(),
        };
        this.rooms.set(id, room);
        return room;
    }
    listRooms() {
        return Array.from(this.rooms.values()).map((r) => ({
            id: r.id,
            createdAt: r.createdAt,
            participants: r.participantSocketIds.size,
        }));
    }
    getRoom(id) {
        const room = this.rooms.get(id);
        if (!room) {
            throw new common_1.NotFoundException('Room not found');
        }
        return room;
    }
    addParticipant(roomId, socketId) {
        const room = this.getRoom(roomId);
        if (room.participantSocketIds.size >= this.maxParticipantsPerRoom) {
            throw new common_1.BadRequestException('Room is full');
        }
        room.participantSocketIds.add(socketId);
        const others = Array.from(room.participantSocketIds).filter((id) => id !== socketId);
        return { existingParticipantIds: others };
    }
    removeParticipant(roomId, socketId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        room.participantSocketIds.delete(socketId);
        if (room.participantSocketIds.size === 0) {
            this.rooms.delete(roomId);
        }
    }
};
exports.RoomsService = RoomsService;
exports.RoomsService = RoomsService = __decorate([
    (0, common_1.Injectable)()
], RoomsService);
//# sourceMappingURL=rooms.service.js.map