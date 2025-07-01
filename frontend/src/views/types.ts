export type Player = { id: string, name: string };
export type Lobby = {
  players: Player[];
  state: 'waiting' | 'active' | 'ended';
};