import { useState, useEffect } from 'react';
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

    // Handle lobby updates
    useEffect(() => {
        if (lobby && username) {
            socket.on("lobbyUpdated", (lobby: Lobby) => {
                setLobbyState(lobby);

                const currentPlayer = lobby.players.find(player => player.name === username);
                setPlayerState(currentPlayer || null);
            });

            // Listen for game start - ALL players should navigate when game starts
            socket.on('gameStarted', (updatedLobby) => {
                console.log('Game started! Navigating to player view...', { username, lobbyCode: updatedLobby.code });
                // Navigate to player view when game starts
                navigate('/player', {
                    state: {
                        username: username,
                        lobby: updatedLobby
                    }
                });
            });

            return () => {
                socket.off("lobbyUpdated");
                socket.off('gameStarted');
            }
        } else {
            setErrorMessage("Invalid lobby access. Redirecting...");
            const timer = setTimeout(() => {
                navigate('/', { replace: true }) // remove history when using back button
            }, 2000)

            return () => clearTimeout(timer);
        }
    }, [lobby, username, navigate]);

    const handleStartGame = () => {
        if (lobbyState?.code) {
            socket.emit('startGame', { lobbyCode: lobbyState.code });

            // Only handle error responses for the host
            socket.on('startGameResponse', (response) => {
                if (!response.success) {
                    setErrorMessage(response.message);
                }
                socket.off('startGameResponse');
            });
        }
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

            <h1>Lobby: {lobbyState?.code}</h1>
            <p className="lobby-status">{lobbyState?.state}</p>
            {errorMessage && <p className="error-message">{errorMessage}</p>}

            <h2>Players ({lobbyState?.players.length ?? 0}/20):</h2>
            {lobbyState?.players.length === 0 ? (
                <p>No players in this lobby yet.</p>
            ) : (
                <ul className="player-list">
                    {lobbyState?.players.map((player: Player) => (
                        <li key={player.id} className={player.name === username ? 'current-player' : ''}>
                            <div className="player-info">
                                <span className="player-name">
                                    {player.name} {player.name === username && '(You)'}
                                    {player.isHost && lobbyState.players[0] && player.id === lobbyState.players[0].id && ' (Host)'}
                                </span>
                                <div className="player-health">
                                    <span className="health-text">{player.health}/{player.maxHealth} HP</span>
                                    <div className="health-bar">
                                        <div
                                            className="health-fill"
                                            style={{ width: `${(player.health / player.maxHealth) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {lobbyState && playerState?.isHost && (
                <button
                    onClick={handleStartGame}
                    className="start-game-button"
                    disabled={lobbyState.players.length < 2} // Disable if not enough players
                >
                    {lobbyState.players.length < 2 ? `Need ${2 - lobbyState.players.length} more players` : 'Start Game'}
                </button>
            )}
            {!(playerState?.isHost ?? false) && ( // This part won't show with isLobbyCreator true, but kept for future
                <p className="waiting-message">Waiting for the host to start the game...</p>
            )}
        </div>
    );
}

export default LobbyPage;
