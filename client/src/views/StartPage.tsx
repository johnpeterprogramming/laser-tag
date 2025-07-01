import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './StartPage.css'; // Create this file for basic styling
import socket from '../socket';
import type { joinOrCreateLobbyResponse } from './types';


function StartPage() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const navigate = useNavigate();
  const [username, setUsername] = useState<string>('');
  const [lobbyCode, setLobbyCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onLobbyCreate(lobbyResponse : joinOrCreateLobbyResponse ) {
      if (!lobbyResponse.success) {
        setErrorMessage(lobbyResponse.message);
      } else {
        navigate(`/lobby`, { state: { username, lobby: lobbyResponse?.lobby } });
      }
    }

    function onLobbyJoin(lobbyResponse : joinOrCreateLobbyResponse ) {
      if (!lobbyResponse.success) {
        setErrorMessage(lobbyResponse.message);
      } else {
        navigate(`/lobby`, { state: { username, lobby: lobbyResponse?.lobby } });
      }
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('createLobbyResponse', onLobbyCreate);
    socket.on('joinLobbyResponse', onLobbyJoin);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('createLobbyResponse', onLobbyCreate);
      socket.off('joinLobbyResponse', onLobbyJoin);
    };
  }, [navigate, username, lobbyCode]);

  const handleJoinLobby = () => {
    if (!username || !lobbyCode) {
      setErrorMessage("Username and Lobby Code are required to join.");
      return;
    }

    if (isConnected) {
      socket.emit('joinLobby', ({ playerName: username.trim(), lobbyCode: lobbyCode.trim() }));
      // TODO: add indication of loading
    } else {
      setErrorMessage("Connection hasn't started.");
      return;
    }
  };


  const handleCreateLobby = () => {
    if (!username.trim()) {
      setErrorMessage("Username is required to create a lobby.");
      return;
    }

    if (isConnected) {
      socket.emit('createLobby', { playerName: username.trim(), lobbyCode: lobbyCode.trim() });
      // TODO: add indication of loading
    } else {
      setErrorMessage("Connection hasn't started.");
    }
  };

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleJoinLobby();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [username, lobbyCode]);

  return (
    <div className="start-page-container">
      {/* 🎮 Floating Shapes */}
      <div className="floating-shapes">
        <div className="shape">🎮</div>
        <div className="shape">🟥</div>
        <div className="shape">🔺</div>
        <div className="shape">🟡</div>

        {/* Gun Target SVGs */}
        <svg className="svg-target" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="40" stroke="#98971a" strokeWidth="3" fill="none" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="#98971a" strokeWidth="2" />
          <line x1="10" y1="50" x2="90" y2="50" stroke="#98971a" strokeWidth="2" />
        </svg>

        <svg className="svg-target" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="30" stroke="#cc241d" strokeWidth="3" fill="none" />
          <line x1="50" y1="0" x2="50" y2="20" stroke="#cc241d" strokeWidth="2" />
          <line x1="50" y1="80" x2="50" y2="100" stroke="#cc241d" strokeWidth="2" />
          <line x1="0" y1="50" x2="20" y2="50" stroke="#cc241d" strokeWidth="2" />
          <line x1="80" y1="50" x2="100" y2="50" stroke="#cc241d" strokeWidth="2" />
        </svg>
      </div>

      {/* 🔴 Laser bullets */}
      <div className="laser-container">
        <div className="laser left-to-right"></div>
        <div className="laser right-to-left"></div>
      </div>

      {/* End test */}

      {/* Main Content Box */}
      <div className="start-box">
        <h1 className="glow-text">Laser Tag Treasure Hunt</h1>

        <div className="input-group">
          <label htmlFor="username">Username:</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            maxLength={15}
          />
        </div>

        <div className="input-group">
          <label htmlFor="lobbyCode">Lobby Code:</label>
          <input
            id="lobbyCode"
            type="text"
            value={lobbyCode}
            onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
            placeholder="Enter lobby code"
            maxLength={6}
          />
        </div>

        {errorMessage && <p className="error-message">{errorMessage}</p>}

        <div className="button-group">
          <button className="glow-btn" onClick={handleJoinLobby}>Join Lobby</button>
          <button className="glow-btn" onClick={handleCreateLobby}>Create New Lobby</button>
        </div>

        <p className="note">Press Enter to join. 4-20 players.</p>
      </div>

    </div>
  );
}

export default StartPage;
