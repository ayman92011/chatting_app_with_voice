import { BACKEND_URL } from './constants';

export async function createRoom(): Promise<{ id: string; createdAt: string }> {
	const res = await fetch(`${BACKEND_URL}/rooms`, { method: 'POST' });
	if (!res.ok) throw new Error(`Failed to create room (${res.status})`);
	return res.json();
}

export async function getRoom(id: string): Promise<{ id: string; createdAt: string; participants: number }> {
	const res = await fetch(`${BACKEND_URL}/rooms/${id}`);
	if (!res.ok) throw new Error(`Room not found (${res.status})`);
	return res.json();
}

export async function listRooms(): Promise<Array<{ id: string; createdAt: string; participants: number }>> {
	const res = await fetch(`${BACKEND_URL}/rooms`);
	if (!res.ok) throw new Error(`Failed to list rooms (${res.status})`);
	return res.json();
}