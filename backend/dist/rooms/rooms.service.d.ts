export interface RoomInfo {
    id: string;
    createdAt: Date;
    participantSocketIds: Set<string>;
}
export declare class RoomsService {
    private rooms;
    private readonly maxParticipantsPerRoom;
    createRoom(): RoomInfo;
    listRooms(): Array<{
        id: string;
        createdAt: Date;
        participants: number;
    }>;
    getRoom(id: string): RoomInfo;
    addParticipant(roomId: string, socketId: string): {
        existingParticipantIds: string[];
    };
    removeParticipant(roomId: string, socketId: string): void;
}
