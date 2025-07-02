import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './LobbyPage.css';
import type { Lobby, Player } from './types';
import socket from '../socket';

function LobbyPage() {
  const location = useLocation();
  const { username, lobby } = location.state || {};
  const navigate = useNavigate();

  const [lobbyState, setLobbyState] = useState<Lobby | null>(lobby);
  const [playerState, setPlayerState] = useState<Player | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (lobby && username) {
      socket.on('lobbyUpdated', (updatedLobby: Lobby) => {
        setLobbyState(updatedLobby);
        const currentPlayer = updatedLobby.players.find((p) => p.name === username);
        setPlayerState(currentPlayer || null);
      });
    } else {
      setErrorMessage('Invalid lobby access. Redirecting...');
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);
      return () => clearTimeout(timer);
    }

    return () => {
      socket.off('lobbyUpdated');
    };
  }, [lobby, username]);

  const handleStartGame = () => {
    alert('Starting game');
  };

  const playerCount = lobbyState?.players.filter((p) => !p.isSpectator).length ?? 0;

  return (
    <div className="lobby-page-container">
      <div className="floating-shapes">
        <div className="shape">🎮</div>
        <div className="shape">🟨</div>
        <div className="shape">🔺</div>
        <div className="shape">🟡</div>
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

      <div className="laser laser-left-to-right"></div>
      <div className="laser laser-right-to-left"></div>

      <h1>Lobby: {lobbyState?.code}</h1>
      <p className="lobby-status">{lobbyState?.state}</p>
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <h2>Players ({playerCount}/20):</h2>
      {lobbyState?.players.length === 0 ? (
        <p>No players in this lobby yet.</p>
      ) : (
        <ul className="player-list">
          {lobbyState?.players.map((player) => (
            <li
              key={player.id}
              className={player.name === username ? 'current-player' : ''}
            >
              {player.name}
              {player.isSpectator && ' 🥽 '}
              {player.name === username && ' (You)'}
              {player.isHost && ' (Host)'}
            </li>
          ))}
        </ul>
      )}

      {lobbyState && playerState?.isHost && (
        <button
          onClick={handleStartGame}
          className="start-game-button"
          disabled={playerCount < 4}
        >
          {playerCount < 4
            ? `Need ${4 - playerCount} more players`
            : 'Start Game'}
        </button>
      )}

      {!playerState?.isHost && (
        <p className="waiting-message">Waiting for the host to start the game...</p>
      )}
    </div>
  );
}

export default LobbyPage;
