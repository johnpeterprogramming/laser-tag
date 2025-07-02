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
            const bodyPixModel = await bodyPix.load();
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
