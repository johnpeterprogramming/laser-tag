import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import './LobbyPage.css';
import type { Lobby, Player } from './types';
import socket from '../socket';

function LobbyPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const location = useLocation();
  const { username, lobbyCode, isLobbyCreator } = location.state || {};
  // const navigate = useNavigate();

  // const [username] = useState<string>(initialUsername); // Current user's username
  const emptyLobby: Lobby = { players: [], state: 'waiting' };
  const [lobbyState, setLobbyState] = useState<Lobby>(emptyLobby);

  const [errorMessage, setErrorMessage] = useState<string>('');
  // const [isLobbyCreator, setIsLobbyCreator] = useState<boolean>(true); // Mock: Assume current user is host for testing 'Start Game' button

  // Handle lobby updates
  useEffect(() => {
    if (lobbyCode && username) {
      socket.on("lobbyUpdated", (lobby: Lobby) => {
        setLobbyState(lobby);

        console.log(lobby);
      });
      return () => {
        socket.off("lobbyUpdated");
      }
    } else {
      console.log("Didn't update lobby, socket isn't connected yet.");
    }
  }, [lobbyCode, username]);

  const handleStartGame = () => {
    // TODO: Start game
    alert("Starting game");
  }


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

      <h1>Lobby: {lobbyCode}</h1>
      <p className="lobby-status">{lobbyState.state}</p>
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <h2>Players ({lobbyState.players.length ?? 0}/20):</h2>
      {lobbyState.players.length === 0 ? (
        <p>No players in this lobby yet.</p>
      ) : (
        <ul className="player-list">
          {lobbyState.players.map((player) => (
            <li key={player.id} className={player.name === username ? 'current-player' : ''}>
              {player.name} {player.name === username && '(You)'}
              {(isLobbyCreator ?? false) && lobbyState.players[0] && player.id === lobbyState.players[0].id && ' (Host)'}
            </li>
          ))}
        </ul>
      )}

      {isLobbyCreator && (
        <button
          onClick={handleStartGame}
          className="start-game-button"
          disabled={lobbyState.players.length < 4} // Disable if not enough players (mock check)
        >
          {lobbyState.players.length < 4 ? `Need ${4 - lobbyState.players.length} more players` : 'Start Game'}
        </button>
      )}
      {!(isLobbyCreator ?? false) && ( // This part won't show with isLobbyCreator true, but kept for future
        <p className="waiting-message">Waiting for the host to start the game...</p>
      )}
    </div>
  );
}

export default LobbyPage;
