import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import './LobbyPage.css';

interface Player {
  id: string;
  username: string;
}

function LobbyPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const initialUsername = (location.state as { username?: string })?.username || 'Guest';

  const [username] = useState<string>(initialUsername);
  const [players, setPlayers] = useState<Player[]>([]);
  const [lobbyStatus, setLobbyStatus] = useState<string>('Lobby ready with mock data!');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLobbyCreator, setIsLobbyCreator] = useState<boolean>(true);

  useEffect(() => {
    const mockPlayers: Player[] = [
      { id: 'mockHost1', username: 'HostPlayer' },
      { id: 'mockPlayer2', username: 'Alice' },
      { id: 'mockPlayer3', username: 'Bob' },
    ];
    if (!mockPlayers.some(p => p.username === username)) {
      mockPlayers.push({ id: `mockUser_${Date.now()}`, username: username });
    }
    setPlayers(mockPlayers);

    const statusTimer = setTimeout(() => {
      setLobbyStatus('Waiting for more players...');
    }, 3000);

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

    return () => {
      clearTimeout(statusTimer);
      clearTimeout(joinTimer);
    };
  }, [username]);

  const handleStartGame = () => {
    if (players.length < 4) {
      setErrorMessage(`Need at least 4 players to start. Current: ${players.length}`);
      return;
    }
    setErrorMessage('');
    setLobbyStatus('Mock Game Starting!');
    navigate(`/game/${lobbyId}`, { state: { username, mockGameData: "Your mock game has begun!" } });
  };

  return (
    <div className="lobby-page-container">
      {/* Floating shapes */}
      <div className="floating-shapes">
        <div className="shape">🎮</div>
        <div className="shape">🟨</div> {/* replaced red square with lighter shape */}
        <div className="shape">🔺</div>
        <div className="shape">🟡</div>

        {/* Gun Target Shapes */}
        <svg className="svg-target" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="40" stroke="#cc241d" strokeWidth="3" fill="none" />
          <line x1="50" y1="0" x2="50" y2="20" stroke="#cc241d" strokeWidth="2" />
          <line x1="50" y1="80" x2="50" y2="100" stroke="#cc241d" strokeWidth="2" />
          <line x1="0" y1="50" x2="20" y2="50" stroke="#cc241d" strokeWidth="2" />
          <line x1="80" y1="50" x2="100" y2="50" stroke="#cc241d" strokeWidth="2" />
        </svg>

        <svg className="svg-target" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="30" stroke="#98971a" strokeWidth="3" fill="none" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="#98971a" strokeWidth="2" />
          <line x1="10" y1="50" x2="90" y2="50" stroke="#98971a" strokeWidth="2" />
        </svg>
      </div>

      {/* Laser animations */}
      <div className="laser laser-left-to-right"></div>
      <div className="laser laser-right-to-left"></div>

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
              {isLobbyCreator && players[0] && player.id === players[0].id && ' (Host)'}
            </li>
          ))}
        </ul>
      )}

      {isLobbyCreator && (
        <button
          onClick={handleStartGame}
          className="start-game-button"
          disabled={players.length < 4}
        >
          {players.length < 4 ? `Need ${4 - players.length} more players` : 'Start Game'}
        </button>
      )}
      {!isLobbyCreator && (
        <p className="waiting-message">Waiting for the host to start the game...</p>
      )}
    </div>
  );
}

export default LobbyPage;
