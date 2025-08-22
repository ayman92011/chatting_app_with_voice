"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalingGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const rooms_service_1 = require("../rooms/rooms.service");
let SignalingGateway = class SignalingGateway {
    roomsService;
    server;
    socketToRoom = new Map();
    constructor(roomsService) {
        this.roomsService = roomsService;
    }
    handleJoin(data, client) {
        const { roomId } = data;
        try {
            const { existingParticipantIds } = this.roomsService.addParticipant(roomId, client.id);
            client.join(roomId);
            this.socketToRoom.set(client.id, roomId);
            client.emit('room-users', {
                existingParticipantSocketIds: existingParticipantIds,
            });
            client.to(roomId).emit('user-joined', { socketId: client.id });
        }
        catch (err) {
            client.emit('join-error', { message: err.message ?? 'Join failed' });
        }
    }
    handleLeave(data, client) {
        const { roomId } = data;
        client.leave(roomId);
        this.roomsService.removeParticipant(roomId, client.id);
        client.to(roomId).emit('user-left', { socketId: client.id });
        this.socketToRoom.delete(client.id);
    }
    handleOffer(data, client) {
        this.server
            .to(data.targetSocketId)
            .emit('offer', { fromSocketId: client.id, offer: data.offer });
    }
    handleAnswer(data, client) {
        this.server
            .to(data.targetSocketId)
            .emit('answer', { fromSocketId: client.id, answer: data.answer });
    }
    handleIceCandidate(data, client) {
        this.server
            .to(data.targetSocketId)
            .emit('ice-candidate', {
            fromSocketId: client.id,
            candidate: data.candidate,
        });
    }
    handleChatMessage(data, client) {
        const { roomId, text } = data || {};
        if (!roomId || !text || typeof text !== 'string') {
            return;
        }
        const joinedRoomId = this.socketToRoom.get(client.id);
        if (joinedRoomId !== roomId) {
            return;
        }
        const payload = {
            roomId,
            text,
            fromSocketId: client.id,
            ts: Date.now(),
        };
        this.server.to(roomId).emit('chat-message', payload);
    }
    handleDisconnect(client) {
        const roomId = this.socketToRoom.get(client.id);
        if (roomId) {
            this.roomsService.removeParticipant(roomId, client.id);
            client.to(roomId).emit('user-left', { socketId: client.id });
            this.socketToRoom.delete(client.id);
        }
    }
};
exports.SignalingGateway = SignalingGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], SignalingGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join-room'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], SignalingGateway.prototype, "handleJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave-room'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], SignalingGateway.prototype, "handleLeave", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('offer'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], SignalingGateway.prototype, "handleOffer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('answer'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], SignalingGateway.prototype, "handleAnswer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('ice-candidate'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], SignalingGateway.prototype, "handleIceCandidate", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('chat-message'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], SignalingGateway.prototype, "handleChatMessage", null);
exports.SignalingGateway = SignalingGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: true, credentials: true },
    }),
    __metadata("design:paramtypes", [rooms_service_1.RoomsService])
], SignalingGateway);
//# sourceMappingURL=signaling.gateway.js.map