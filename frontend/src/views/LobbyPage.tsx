// frontend/src/views/LobbyPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import './LobbyPage.css'; 
interface Player {
  id: string;
  username: string;
}

function LobbyPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>(); // Get lobbyId from URL
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get initial username from StartPage navigation state
  const initialUsername = (location.state as { username?: string })?.username || 'Guest';

  const [username] = useState<string>(initialUsername); // Current user's username
  const [players, setPlayers] = useState<Player[]>([]);
  const [lobbyStatus, setLobbyStatus] = useState<string>('Lobby ready with mock data!');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLobbyCreator, setIsLobbyCreator] = useState<boolean>(true); // Mock: Assume current user is host for testing 'Start Game' button

  useEffect(() => {
    const mockPlayers: Player[] = [
      { id: 'mockHost1', username: 'HostPlayer' },
      { id: 'mockPlayer2', username: 'Alice' },
      { id: 'mockPlayer3', username: 'Bob' },
    ];
    // Add current user to mock players if not already present
    if (!mockPlayers.some(p => p.username === username)) {
      mockPlayers.push({ id: `mockUser_${Date.now()}`, username: username });
    }
    setPlayers(mockPlayers);

    // Simulate lobby status updates over time (optional, for more dynamic mock)
    const statusTimer = setTimeout(() => {
      setLobbyStatus('Waiting for more players...');
    }, 3000);

    // Simulate a player joining after a delay
    const joinTimer = setTimeout(() => {
        const newPlayer: Player = { id: 'mockNewGuy', username: 'Charlie' };
        setPlayers(prevPlayers => {
            if (!prevPlayers.some(p => p.id === newPlayer.id)) {
                return [...prevPlayers, newPlayer];
            }
            return prevPlayers;
        });
        setLobbyStatus(`${newPlayer.username} joined the mock lobby!`);
    }, 5000);


    // Cleanup timers on component unmount
    return () => {
      clearTimeout(statusTimer);
      clearTimeout(joinTimer);
    };
  }, [username]); 

  const handleStartGame = () => {
    if (players.length < 4) { // Enforce minimum player count (mock check)
      setErrorMessage(`Need at least 4 players to start. Current: ${players.length}`);
      return;
    }
    setErrorMessage('');
    console.log(`Mock: Game started for lobby: ${lobbyId}`);
    setLobbyStatus('Mock Game Starting!');
    // In a real scenario, this would emit a socket event to the server.
    // For now, just navigate to a placeholder game page.
    navigate(`/game/${lobbyId}`, { state: { username, mockGameData: "Your mock game has begun!" } });
  };

  return (
    <div className="lobby-page-container">
      <h1>Lobby: {lobbyId}</h1>
      <p className="lobby-status">{lobbyStatus}</p>
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <h2>Players ({players.length}/20):</h2>
      {players.length === 0 ? (
        <p>No players in this lobby yet.</p>
      ) : (
        <ul className="player-list">
          {players.map((player) => (
            <li key={player.id} className={player.username === username ? 'current-player' : ''}>
              {player.username} {player.username === username && '(You)'}
              {isLobbyCreator && players[0] && player.id === players[0].id && ' (Host)'} {/* Mock host display */}
            </li>
          ))}
        </ul>
      )}

      {isLobbyCreator && ( 
        <button
          onClick={handleStartGame}
          className="start-game-button"
          disabled={players.length < 4} // Disable if not enough players (mock check)
        >
          {players.length < 4 ? `Need ${4 - players.length} more players` : 'Start Game'}
        </button>
      )}
      {!isLobbyCreator && ( // This part won't show with isLobbyCreator true, but kept for future
        <p className="waiting-message">Waiting for the host to start the game...</p>
      )}
    </div>
  );
}

export default LobbyPage;