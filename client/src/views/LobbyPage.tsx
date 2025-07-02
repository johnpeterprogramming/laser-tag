import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './LobbyPage.css';
import type { Lobby, Player } from '../../../types';
import socket from '../socket';
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as bodyPix from "@tensorflow-models/body-pix";
import "@tensorflow/tfjs";

function LobbyPage() {
    const location = useLocation();
    const { username, lobby } = location.state || {};
    const navigate = useNavigate();

    const [lobbyState, setLobbyState] = useState<Lobby | null>(lobby);
    const [playerState, setPlayerState] = useState<Player | null>(null);

    const [errorMessage, setErrorMessage] = useState<string>('');

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [bodyPixModel, setBodyPixModel] = useState<bodyPix.BodyPix | null>(null);
    const [cocoModel, setCocoModel] = useState<cocoSsd.ObjectDetection | null>(null);
    const selfieNotTaken = useRef(true); // Track if selfie has NOT been taken

    // Handle lobby updates
    useEffect(() => {
        initializeCamera();
        loadModels();
        
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

    const loadModels = async () => {
        try {
            const [cocoModel, bodyPixModel] = await Promise.all([
                cocoSsd.load(),
                bodyPix.load()
            ]);
            setCocoModel(cocoModel);
            setBodyPixModel(bodyPixModel);
            console.log('Models loaded successfully:', { cocoModel, bodyPixModel });
        } catch (error) {
            console.error('Error loading models:', error);
        }
    };

    const initializeCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
        //   facingMode: 'environment', // Use back camera for better photos
        //   width: { ideal: 1280 },
        //   height: { ideal: 720 }
        }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        console.log(mediaStream);
      }
    } catch (error) {
      console.error('Failed to access camera:', error);
      alert('Camera access is required to detect your shirt color. Please allow camera permissions.');
    }
  };

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

    const handleTakeSelfie = () => {
        if (!videoRef.current || !canvasRef.current) {
            console.error('Video or canvas not available');
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        // const cocoModel = cocoModel.current;

        if (!ctx) {
            console.error('Canvas context not available');
            return;
        }

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get image data from center of canvas (for shirt color detection)
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const imageData = ctx.getImageData(centerX - 50, centerY - 50, 100, 100);
        
        // Calculate average RGB values
        let totalR = 0, totalG = 0, totalB = 0;
        const pixels = imageData.data;
        const pixelCount = pixels.length / 4;

        for (let i = 0; i < pixels.length; i += 4) {
            totalR += pixels[i];
            totalG += pixels[i + 1];
            totalB += pixels[i + 2];
        }

        const avgR = Math.round(totalR / pixelCount);
        const avgG = Math.round(totalG / pixelCount);
        const avgB = Math.round(totalB / pixelCount);

        // Send RGB data to backend
        if (lobbyState?.code && username) {
            socket.emit('playerColorDetected', {
                lobbyCode: lobbyState.code,
                username: username,
                rgb: { r: avgR, g: avgG, b: avgB }
            });

            console.log(`Detected color RGB(${avgR}, ${avgG}, ${avgB}) for player ${username}`);
        }

        // hide the video element and button after taking a selfie
        if (videoRef.current) {
            videoRef.current.style.display = 'none'; // Hide the video element after taking a selfie
            selfieNotTaken.current = false; // Mark that a selfie has been taken
        }
    }


    return (

        <div className="lobby-page-container">
            {/* Video stream and canvas for object detection */}
            {lobbyState && selfieNotTaken.current&& (
                <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="player-video"
                style={{
                    background: '#000',
                    display: 'block' // Ensure video is visible
                }}
            />)}
            {lobbyState && selfieNotTaken.current&& (<canvas
                ref={canvasRef}
                className="player-canvas"
            />)}
            {/* Bottom button positioned over video */}
            {lobbyState && selfieNotTaken.current&& (
                <button
                    className="bottom-button"
                    onClick={handleTakeSelfie}
                >
                    Take a selfie to detect your shirt color
                </button>
            )}

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
            <div className="player-list-scroll-wrapper">
                {lobbyState?.players.length === 0 ? (
                    <p>No players in this lobby yet.</p>
                ) : (
                    <ul className="player-list">
                        {lobbyState?.players.map((player: Player) => (
                            <li key={player.id} className={player.name === username ? 'current-player' : ''}>
                                <div className="player-info">
                                    <span className="player-name">
                                        {player.name} {player.name === username && '(You)'}
                                        {player.isSpectator && ' 🥽 '}
                                        {player.isHost && ' (Host)'}
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
            </div>

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
