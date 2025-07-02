export type Player = { 
    id: string, 
    name: string, 
    isHost: boolean, 
    health: number, 
    maxHealth: number, 
    r?: number, 
    g?: number, 
    b?: number 
};
export type Lobby = {
    code: string,
    players: Player[];
    state: 'waiting' | 'active' | 'ended';
};
export interface joinOrCreateLobbyResponse {
    success: boolean,
    message: string,
    lobby: Lobby | null // only returns a lobby on success
}