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
    // @ts-ignore
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [bodyPixModel, setBodyPixModel] = useState<bodyPix.BodyPix | null>(null);
    const [cocoModel, setCocoModel] = useState<cocoSsd.ObjectDetection | null>(null); // For future features
    const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
    const selfieNotTaken = useRef(true); // Track if selfie has NOT been taken

    // Suppress unused variable warning for cocoModel (reserved for future features)
    void cocoModel;

    // Load models before camera initialization
    useEffect(() => {
        loadModels();
    }, []);

    // Initialize camera after models are loaded
    useEffect(() => {
        if (modelsLoaded) {
            initializeCamera();
        }
    }, [modelsLoaded]);

    // Handle lobby updates
    useEffect(() => {
        if (lobby && username) {
            socket.on("lobbyUpdated", (lobby: Lobby) => {
                setLobbyState(lobby);

                const currentPlayer = lobby.players.find(player => player.name === username);
                setPlayerState(currentPlayer || null);
            });

            // Listen for game start - route based on player type
            socket.on('gameStarted', (updatedLobby) => {
                const currentPlayer = updatedLobby.players.find((player: Player) => player.name === username);
                if (currentPlayer?.isSpectator) {
                    // Spectators go to spectator view
                    navigate('/spectator', {
                        state: {
                            lobby: updatedLobby
                        }
                    });
                } else {
                    // Players go to player view
                    navigate('/player', {
                        state: {
                            username: username,
                            lobby: updatedLobby
                        }
                    });
                }
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
            console.log("🤖 Loading AI models...");

            const [bodyPixModelResult, cocoModelResult] = await Promise.all([
                bodyPix.load(),
                cocoSsd.load()
            ]);

            setBodyPixModel(bodyPixModelResult);
            setCocoModel(cocoModelResult);
            setModelsLoaded(true);

            console.log('✅ AI models loaded successfully');
        } catch (error) {
            console.error('❌ Error loading AI models:', error);
            setModelsLoaded(false);
        }
    };

    const initializeCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                      facingMode: 'environment', // Use back camera for better photos
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
            // Check if all players have shirt colors detected
            const allPlayersHaveColors = lobbyState.players.every(player =>
                player.r !== undefined && player.g !== undefined && player.b !== undefined
            );

            if (!allPlayersHaveColors) {
                setErrorMessage("All players must take a selfie to detect their shirt color before starting the game.");
                return;
            }

            socket.emit('startGame', { lobbyCode: lobbyState.code });

            // Only handle error responses for the host
            socket.on('startGameResponse', (response) => {
                if (!response.success) {
                    setErrorMessage(response.message);
                }
                socket.off('startGameResponse');
            });

            // If current user is a spectator, redirect to spectator view with lobby data
            if (playerState?.isSpectator) {
                navigate('/spectator', { state: { lobby: lobbyState } });
            }
        }
    }

    const handleTakeSelfie = async () => {
        if (!videoRef.current || !canvasRef.current) {
            console.error('Video or canvas not available');
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            console.error('Canvas context not available');
            return;
        }

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Perform body segmentation
        const segmentation = await bodyPixModel?.segmentPersonParts(video, {
            flipHorizontal: false,
            internalResolution: 'low',
            segmentationThreshold: 0.7,
            maxDetections: 1,
            scoreThreshold: 0.5
        });

        console.log('Segmentation result:', segmentation);

        if (!segmentation || !segmentation.data) {
            console.error('Segmentation failed');
            return;
        }

        const { data: partMap } = segmentation;
        const uniqueParts = [...new Set(partMap)];
        console.log('Detected body parts:', uniqueParts);

        // Get the original image data from canvas
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        // Body part IDs in BodyPix (torso area for shirt detection):
        // 12 = torso_front, 13 = torso_back
        // 2 = left_face, 3 = right_face, 4 = left_upper_arm_front, 5 = left_upper_arm_back
        // We'll focus on torso and upper body parts for shirt color
        const targetBodyParts = [12, 13, 2, 3, 4, 5]; // torso_front, torso_back, faces, upper arms

        let shirtPixels = [];

        // Extract pixels that belong to the torso (shirt area)
        for (let i = 0; i < partMap.length; i++) {
            const bodyPart = partMap[i];

            if (targetBodyParts.includes(bodyPart)) {
                const pixelIndex = i * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];

                // Quantize colors to reduce noise (group similar colors together)
                const quantizedR = Math.round(r / 16) * 16;
                const quantizedG = Math.round(g / 16) * 16;
                const quantizedB = Math.round(b / 16) * 16;

                shirtPixels.push({ r: quantizedR, g: quantizedG, b: quantizedB });
            }
        }

        console.log(`Found ${shirtPixels.length} shirt pixels from torso segmentation`);

        let modeR, modeG, modeB;

        if (shirtPixels.length > 0) {
            // Find mode (most frequent) color
            const colorCounts = new Map();

            shirtPixels.forEach(pixel => {
                const colorKey = `${pixel.r},${pixel.g},${pixel.b}`;
                colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
            });

            // Find the most frequent color
            let maxCount = 0;
            let modeColor = null;

            for (const [colorKey, count] of colorCounts.entries()) {
                if (count > maxCount) {
                    maxCount = count;
                    modeColor = colorKey;
                }
            }

            if (modeColor) {
                const [r, g, b] = modeColor.split(',').map(Number);
                modeR = r;
                modeG = g;
                modeB = b;
                console.log(`Shirt color from torso mode: RGB(${modeR}, ${modeG}, ${modeB}) with ${maxCount} occurrences`);
            }
        } else {
            // Fallback to center area if no torso detected
            console.warn('No torso detected, falling back to center area sampling');
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const fallbackImageData = ctx.getImageData(centerX - 50, centerY - 50, 100, 100);
            const fallbackPixels = fallbackImageData.data;

            const fallbackColors = [];
            for (let i = 0; i < fallbackPixels.length; i += 4) {
                const r = Math.round(fallbackPixels[i] / 16) * 16;
                const g = Math.round(fallbackPixels[i + 1] / 16) * 16;
                const b = Math.round(fallbackPixels[i + 2] / 16) * 16;
                fallbackColors.push({ r, g, b });
            }

            // Find mode color in fallback area
            const colorCounts = new Map();
            fallbackColors.forEach(pixel => {
                const colorKey = `${pixel.r},${pixel.g},${pixel.b}`;
                colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
            });

            let maxCount = 0;
            let modeColor = null;

            for (const [colorKey, count] of colorCounts.entries()) {
                if (count > maxCount) {
                    maxCount = count;
                    modeColor = colorKey;
                }
            }

            if (modeColor) {
                const [r, g, b] = modeColor.split(',').map(Number);
                modeR = r;
                modeG = g;
                modeB = b;
                console.log(`Fallback shirt color from center mode: RGB(${modeR}, ${modeG}, ${modeB}) with ${maxCount} occurrences`);
            }
        }

        // Send RGB data to backend
        if (lobbyState?.code && username) {
            socket.emit('playerColorDetected', {
                lobbyCode: lobbyState.code,
                username: username,
                rgb: { r: modeR, g: modeG, b: modeB }
            });

            console.log(`Detected shirt color RGB(${modeR}, ${modeG}, ${modeB}) for player ${username} using mode color from ${shirtPixels.length} torso pixels`);
        }

        // Hide the video and canvas after taking a selfie
        if (videoRef.current) {
            videoRef.current.style.display = 'none';
        }
        if (canvasRef.current) {
            canvasRef.current.style.display = 'none';
        }
        selfieNotTaken.current = false;
    }


    return (

        <div className="lobby-page-container">
            {/* Video stream and canvas for object detection */}
            {lobbyState && selfieNotTaken.current && (
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
            {lobbyState && selfieNotTaken.current && (<canvas
                ref={canvasRef}
                className="player-canvas"
            />)}
            {/* Bottom button positioned over video - only show after models are loaded */}
            {lobbyState && selfieNotTaken.current && modelsLoaded && (
                <button
                    className="bottom-button"
                    onClick={handleTakeSelfie}
                >
                    Have someone scan you in by taking a picture to detect your shirt color. Make sure your shirt is clearly visible.
                </button>
            )}
            {lobbyState && selfieNotTaken.current && modelsLoaded && (<p className="selfie-instructions">
                
            </p>)}

            {/* Loading overlay when models are loading */}
            {lobbyState && selfieNotTaken.current && !modelsLoaded && (
                <div className="loading-overlay" style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    color: "white",
                    textAlign: "center",
                    zIndex: 5,
                    background: "rgba(0,0,0,0.8)",
                    padding: "20px",
                    borderRadius: "10px",
                }}>
                    <div>🤖 Loading AI Models...</div>
                    <div style={{ fontSize: "0.8rem", marginTop: "10px" }}>
                        Setting up color detection for shirt recognition
                    </div>
                </div>
            )}

            {/* Floating shapes */}
            <div className="floating-shapes">
                <div className="shape">🎮</div>
                <div className="shape">🟨</div>
                <div className="shape">🔺</div>
                <div className="shape">🟡</div>
                <div className="shape">⚡</div>
                <div className="shape">💥</div>
                <div className="shape">🎯</div>

                {/* Enhanced Gun Target Shapes */}
                <svg className="svg-target" viewBox="0 0 100 100" aria-hidden="true">
                    <circle cx="50" cy="50" r="40" stroke="#cc241d" strokeWidth="3" fill="none" />
                    <circle cx="50" cy="50" r="25" stroke="#cc241d" strokeWidth="2" fill="none" />
                    <circle cx="50" cy="50" r="10" stroke="#cc241d" strokeWidth="2" fill="none" />
                    <line x1="50" y1="0" x2="50" y2="20" stroke="#cc241d" strokeWidth="2" />
                    <line x1="50" y1="80" x2="50" y2="100" stroke="#cc241d" strokeWidth="2" />
                    <line x1="0" y1="50" x2="20" y2="50" stroke="#cc241d" strokeWidth="2" />
                    <line x1="80" y1="50" x2="100" y2="50" stroke="#cc241d" strokeWidth="2" />
                </svg>

                <svg className="svg-target" viewBox="0 0 100 100" aria-hidden="true">
                    <circle cx="50" cy="50" r="35" stroke="#98971a" strokeWidth="3" fill="none" />
                    <circle cx="50" cy="50" r="20" stroke="#98971a" strokeWidth="2" fill="none" />
                    <circle cx="50" cy="50" r="5" stroke="#98971a" strokeWidth="2" fill="#98971a" />
                    <line x1="50" y1="10" x2="50" y2="90" stroke="#98971a" strokeWidth="2" />
                    <line x1="10" y1="50" x2="90" y2="50" stroke="#98971a" strokeWidth="2" />
                </svg>
            </div>

            {/* Enhanced Laser animations */}
            <div className="laser-container">
                <div className="laser laser-left-to-right"></div>
                <div className="laser laser-right-to-left"></div>
                <div className="laser laser-left-to-right" style={{ top: '25%', animationDelay: '5s' }}></div>
                <div className="laser laser-right-to-left" style={{ top: '75%', animationDelay: '12s' }}></div>
            </div>
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
                        {lobbyState?.players.map((player: Player) => {
                            // Compose color from r,g,b if present, else fallback
                            const rgb = (typeof player.r === 'number' && typeof player.g === 'number' && typeof player.b === 'number')
                                ? `rgb(${player.r},${player.g},${player.b})`
                                : '#b8bb26';
                            const rgbShadow = (typeof player.r === 'number' && typeof player.g === 'number' && typeof player.b === 'number')
                                ? `rgba(${player.r},${player.g},${player.b},0.7)`
                                : '#fabd2f';
                            return (
                                <li key={player.id} className={player.name === username ? 'current-player' : ''}>
                                    <div className="player-info">
                                        <span className="player-color-dot" style={{ background: rgb, boxShadow: `0 0 8px ${rgbShadow}`, display: 'inline-block', width: 18, height: 18, borderRadius: '50%', marginRight: 10, border: '2px solid #928374', verticalAlign: 'middle' }}></span>
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
                                        {/* Show player's detected color if available */}
                                        {player.r !== undefined && player.g !== undefined && player.b !== undefined && (
                                            <div
                                                className="player-color-circle"
                                                style={{
                                                    backgroundColor: `rgb(${player.r}, ${player.g}, ${player.b})`,
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: '50%',
                                                    marginLeft: '10px',
                                                    border: '2px solid white'
                                                }}
                                                title={`Detected color: RGB(${player.r}, ${player.g}, ${player.b})`}
                                            ></div>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {lobbyState && playerState?.isHost && (
                <button
                    onClick={handleStartGame}
                    className="start-game-button"
                    disabled={
                        lobbyState.players.length < 2 ||
                        !lobbyState.players.every(player =>
                            player.r !== undefined && player.g !== undefined && player.b !== undefined
                        )
                    }
                >
                    {lobbyState.players.length < 2
                        ? `Need ${2 - lobbyState.players.length} more players`
                        : !lobbyState.players.every(player =>
                            player.r !== undefined && player.g !== undefined && player.b !== undefined
                        )
                            ? "Waiting for all players to detect shirt colors"
                            : 'Start Game'
                    }
                </button>
            )}
            {!(playerState?.isHost ?? false) && ( // This part won't show with isLobbyCreator true, but kept for future
                <p className="waiting-message">Waiting for the host to start the game...</p>
            )}
        </div>
    );
}

export default LobbyPage;
