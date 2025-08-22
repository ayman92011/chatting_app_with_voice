import { Server, Socket } from 'socket.io';
import { RoomsService } from '../rooms/rooms.service';
export declare class SignalingGateway {
    private readonly roomsService;
    server: Server;
    private socketToRoom;
    constructor(roomsService: RoomsService);
    handleJoin(data: {
        roomId: string;
        userId?: string;
    }, client: Socket): void;
    handleLeave(data: {
        roomId: string;
    }, client: Socket): void;
    handleOffer(data: {
        targetSocketId: string;
        offer: any;
    }, client: Socket): void;
    handleAnswer(data: {
        targetSocketId: string;
        answer: any;
    }, client: Socket): void;
    handleIceCandidate(data: {
        targetSocketId: string;
        candidate: any;
    }, client: Socket): void;
    handleChatMessage(data: {
        roomId: string;
        text: string;
    }, client: Socket): void;
    handleDisconnect(client: Socket): void;
}
