import { RoomsService } from './rooms.service';
export declare class RoomsController {
    private readonly roomsService;
    constructor(roomsService: RoomsService);
    create(): {
        id: string;
        createdAt: Date;
    };
    list(): {
        id: string;
        createdAt: Date;
        participants: number;
    }[];
    get(id: string): {
        id: string;
        createdAt: Date;
        participants: number;
    };
}
