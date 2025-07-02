import { useRef, useEffect, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as bodyPix from "@tensorflow-models/body-pix";
import "@tensorflow/tfjs";
import "./PlayerView.css";
import { socket } from "../socket";
import { useLocation } from "react-router-dom";

interface LocationState {
    username: string;
    lobby: Lobby;
}

interface Particle {
    id: number;
}

interface Player {
    id: string;
    name: string;
    health: number;
    r?: number;
    g?: number;
    b?: number;
}

interface Lobby {
    code: string;
    players: Player[];
    state: string;
}

export default function PlayerView() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [particles, setParticles] = useState<Particle[]>([]);
    const [bodyPixNet, setBodyPixNet] = useState<bodyPix.BodyPix | null>(null);
    const predictionsRef = useRef<cocoSsd.DetectedObject[]>([]);

    const [health, setHealth] = useState<number>(100);
    const [maxHealth] = useState<number>(100);
    const [cameraRequested, setCameraRequested] = useState<boolean>(true); // Start with camera requested
    const [cameraLoading, setCameraLoading] = useState<boolean>(true); // Start with camera loading
    const [error, setError] = useState<string | null>(null);
    const [recoil, setRecoil] = useState<boolean>(false);

    const location = useLocation();
    const { username, lobby } = (location.state as LocationState) || {};
    const lobbyCode = lobby?.code || "";
    const [currentLobby, setCurrentLobby] = useState<Lobby | undefined>(lobby);

    // Debug logging
    // console.log('PlayerView render:', { username, lobby, lobbyCode, currentLobby });

    // Add debug state for camera status
    // @ts-ignore
    const [cameraDebug, setCameraDebug] = useState<{
        hasStream: boolean;
        hasVideoElement: boolean;
        videoWidth: number;
        videoHeight: number;
        readyState: number;
        error: string | null;
    }>({
        hasStream: false,
        hasVideoElement: false,
        videoWidth: 0,
        videoHeight: 0,
        readyState: 0,
        error: null,
    });

    // Update debug info periodically and immediately when video changes
    useEffect(() => {
        const updateDebugInfo = () => {
            if (videoRef.current) {
                setCameraDebug({
                    hasStream: !!videoRef.current.srcObject,
                    hasVideoElement: !!videoRef.current,
                    videoWidth: videoRef.current.videoWidth || 0,
                    videoHeight: videoRef.current.videoHeight || 0,
                    readyState: videoRef.current.readyState || 0,
                    error: error,
                });
            }
        };

        // Update immediately
        updateDebugInfo();

        // Then update every second
        const debugInterval = setInterval(updateDebugInfo, 1000);

        return () => clearInterval(debugInterval);
    }, [error]);

    // Automatically start camera initialization when component mounts
    useEffect(() => {
        initCamera();
    }, []);

    // Camera initialization function (automatically called on mount)
    const initCamera = async () => {
        if (cameraRequested && !cameraLoading) return; // Prevent multiple requests

        console.log("🎯 Starting automatic camera initialization");
        setCameraRequested(true);
        setCameraLoading(true);

        let model: cocoSsd.ObjectDetection;
        let modelLoaded = false;
        let stream: MediaStream;
        // let animationId: number;
        let cameraTimeout: NodeJS.Timeout;

        // Set a timeout to clear camera loading state if camera/model fails
        cameraTimeout = setTimeout(() => {
            console.log("⏰ Camera loading timeout reached");
            setCameraLoading(false);
        }, 10000); // Longer timeout for camera

        const canvas = (predictions: cocoSsd.DetectedObject[]) => {
            if (!canvasRef.current) return;
            const ctx = canvasRef.current.getContext("2d");
            if (!ctx) return;

            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

            // Draw crosshair
            ctx.strokeStyle = "black";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(
                canvasRef.current.width / 2,
                canvasRef.current.height / 2 - 11,
            );
            ctx.lineTo(
                canvasRef.current.width / 2,
                canvasRef.current.height / 2 + 11,
            );
            ctx.moveTo(
                canvasRef.current.width / 2 - 11,
                canvasRef.current.height / 2,
            );
            ctx.lineTo(
                canvasRef.current.width / 2 + 11,
                canvasRef.current.height / 2,
            );
            ctx.stroke();

            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(
                canvasRef.current.width / 2,
                canvasRef.current.height / 2 - 10,
            );
            ctx.lineTo(
                canvasRef.current.width / 2,
                canvasRef.current.height / 2 + 10,
            );
            ctx.moveTo(
                canvasRef.current.width / 2 - 10,
                canvasRef.current.height / 2,
            );
            ctx.lineTo(
                canvasRef.current.width / 2 + 10,
                canvasRef.current.height / 2,
            );
            ctx.stroke();

            // Draw detection boxes for people
            predictions.forEach((pred) => {
                if (pred.class === "person" && pred.score > 0.5) {
                    ctx.strokeStyle = "red";
                    ctx.lineWidth = 2;
                    ctx.strokeRect(...pred.bbox);
                    ctx.font = "16px Arial";
                    ctx.fillStyle = "red";
                }
            });
        };

        const loadModel = async () => {
            try {
                console.log("Loading TensorFlow model...");
                model = await cocoSsd.load();

                const bpNet = await bodyPix.load();
                modelLoaded = true;
                setBodyPixNet(bpNet);

                console.log("TensorFlow model loaded successfully");
                // Start detection loop only if video is ready
                if (videoRef.current && videoRef.current.readyState >= 2) {
                    detectFrame();
                }
            } catch (error) {
                console.error("Error loading TensorFlow model:", error);
                // Continue without model detection
                modelLoaded = false;
            }
        };

        const detectFrame = async () => {
            if (videoRef.current && modelLoaded && videoRef.current.readyState >= 2) {
                try {
                    const predictions = await model.detect(videoRef.current);
                    predictionsRef.current = predictions;

                    // Could be unnecessary, but fine for now
                    if (canvasRef.current) {
                        canvas(predictions);
                    }
                } catch (error) {
                    console.error("Detection error:", error);
                }
            }
            requestAnimationFrame(detectFrame);
        };

        const setupVideoAndCanvas = (): boolean => {
            if (!videoRef.current || !canvasRef.current) return false;

            console.log(
                "Setting up video and canvas, readyState:",
                videoRef.current.readyState,
                "dimensions:",
                videoRef.current.videoWidth,
                "x",
                videoRef.current.videoHeight,
            );

            // Check if video has dimensions (means it's loaded)
            if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                console.log(
                    "✅ Canvas dimensions set:",
                    canvasRef.current.width,
                    canvasRef.current.height,
                );
                clearTimeout(cameraTimeout);
                setCameraLoading(false);
                loadModel();
                return true;
            }
            return false;
        };

        try {
            console.log("🎥 Requesting camera access...");

            // TODO: Remove unnecessary looping???
            const cameraConfigs = [
                {
                    video: {
                        facingMode: "environment",
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                },
                {
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                },
                {
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                    },
                },
                {
                    video: true,
                },
            ];

            let streamResult: MediaStream | null = null;
            let lastError: Error | null = null;

            for (const config of cameraConfigs) {
                try {
                    console.log("Trying camera config:", config);
                    streamResult = await navigator.mediaDevices.getUserMedia(config);
                    console.log("✅ Camera stream obtained with config:", config);
                    break;
                } catch (err) {
                    console.log("❌ Camera config failed:", config, err);
                    lastError = err as Error;
                    continue;
                }
            }

            if (!streamResult) {
                throw lastError || new Error("No camera configuration worked");
            }

            stream = streamResult;

            if (videoRef.current) {
                console.log("🎬 Assigning stream to video element...");
                videoRef.current.srcObject = stream;

                // Force video properties immediately
                videoRef.current.muted = true;
                videoRef.current.playsInline = true;
                videoRef.current.autoplay = true;

                // Log stream assignment
                console.log("✅ Stream assigned to video element:", {
                    hasStream: !!videoRef.current.srcObject,
                    streamActive: stream.active,
                    tracks: stream
                        .getTracks()
                        .map((t) => ({
                            kind: t.kind,
                            enabled: t.enabled,
                            readyState: t.readyState,
                        })),
                });

                // Force debug update immediately
                setCameraDebug((prev) => ({
                    ...prev,
                    hasStream: !!videoRef.current?.srcObject,
                    hasVideoElement: !!videoRef.current,
                }));

                // Wait a bit for the stream to be processed by the video element
                await new Promise((resolve) => setTimeout(resolve, 100));

                // Try to set up immediately (for pre-granted permissions)
                let setupSuccess = setupVideoAndCanvas();

                if (!setupSuccess) {
                    console.log(
                        "📱 Video not ready yet, setting up event listeners and polling...",
                    );

                    const handleVideoReady = () => {
                        console.log(
                            "🎬 Video ready event triggered, readyState:",
                            videoRef.current?.readyState,
                        );
                        if (setupVideoAndCanvas()) {
                            console.log("✅ Setup successful via event listener");
                            // Remove listeners once successful
                            videoRef.current?.removeEventListener(
                                "loadeddata",
                                handleVideoReady,
                            );
                            videoRef.current?.removeEventListener(
                                "loadedmetadata",
                                handleVideoReady,
                            );
                            videoRef.current?.removeEventListener(
                                "canplay",
                                handleVideoReady,
                            );
                            videoRef.current?.removeEventListener(
                                "playing",
                                handleVideoReady,
                            );
                        }
                    };

                    // Listen for multiple events to catch when video is ready
                    videoRef.current.addEventListener("loadeddata", handleVideoReady);
                    videoRef.current.addEventListener("loadedmetadata", handleVideoReady);
                    videoRef.current.addEventListener("canplay", handleVideoReady);
                    videoRef.current.addEventListener("playing", handleVideoReady);

                    // More aggressive polling for video readiness
                    let pollCount = 0;
                    const maxPolls = 100; // Increased to 10 seconds
                    const pollInterval = setInterval(() => {
                        pollCount++;
                        const currentDimensions = `${videoRef.current?.videoWidth || 0}x${videoRef.current?.videoHeight || 0}`;
                        const currentReadyState = videoRef.current?.readyState || 0;

                        console.log(
                            `📊 Poll ${pollCount}/${maxPolls}: Dimensions=${currentDimensions}, ReadyState=${currentReadyState}, HasSrcObject=${!!videoRef.current?.srcObject}`,
                        );

                        if (setupVideoAndCanvas()) {
                            console.log("✅ Video setup successful via polling");
                            clearInterval(pollInterval);
                            // Remove event listeners
                            videoRef.current?.removeEventListener(
                                "loadeddata",
                                handleVideoReady,
                            );
                            videoRef.current?.removeEventListener(
                                "loadedmetadata",
                                handleVideoReady,
                            );
                            videoRef.current?.removeEventListener(
                                "canplay",
                                handleVideoReady,
                            );
                            videoRef.current?.removeEventListener(
                                "playing",
                                handleVideoReady,
                            );
                        } else if (pollCount >= maxPolls) {
                            console.log(
                                "⚠️ Polling timeout reached, forcing camera loading clear",
                            );
                            clearInterval(pollInterval);
                            clearTimeout(cameraTimeout);
                            setCameraLoading(false);
                            console.log("💡 Final state check:", {
                                hasVideoRef: !!videoRef.current,
                                hasCanvasRef: !!canvasRef.current,
                                hasStream: !!videoRef.current?.srcObject,
                                videoDimensions: `${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`,
                                readyState: videoRef.current?.readyState,
                            });
                        }
                    }, 100);
                } else {
                    console.log("✅ Video setup successful immediately");
                }

                // Try to play the video with more aggressive approach
                const playVideo = async () => {
                    try {
                        console.log("🎬 Attempting to play video...");
                        if (videoRef.current) {
                            await videoRef.current.play();
                            console.log("✅ Video playing successfully");
                        }
                    } catch (playError) {
                        console.log("⚠️ Video play failed, retrying...", playError);
                        // Retry after a short delay
                        setTimeout(() => {
                            videoRef.current
                                ?.play()
                                .catch((e) =>
                                    console.log("❌ Final video play attempt failed:", e),
                                );
                        }, 500);
                    }
                };

                // Start playing immediately and also after a delay
                playVideo();
                setTimeout(playVideo, 200);
            } else {
                console.log("❌ No video element found");
            }
        } catch (error) {
            console.error("❌ Error accessing camera:", error);
            clearTimeout(cameraTimeout);
            setCameraLoading(false);
            setError(
                "Camera access denied. Please allow camera access and refresh the page.",
            );
        }
    };
    // Join socket room and initialize player data
    useEffect(() => {
        if (lobbyCode && username) {
            // Join the lobby room to receive updates
            socket.emit("joinRoom", { lobbyCode });

            // Initialize health from lobby data if available
            if (currentLobby) {
                const currentPlayer = currentLobby.players.find(
                    (p: Player) => p.name === username,
                );
                if (currentPlayer) {
                    setHealth(currentPlayer.health);
                }
            }
        }
    }, [lobbyCode, username, currentLobby]);

    // Socket listeners for health events
    useEffect(() => {
        const handlePlayerHit = (data: {
            targetId: string;
            targetHealth: number;
        }) => {
            if (data.targetId === socket.id) {
                setHealth(data.targetHealth);
                // Add hit effect
                document.body.style.background = "rgba(255, 0, 0, 0.3)";
                setTimeout(() => {
                    document.body.style.background = "";
                }, 200);
            }
        };

        const handlePlayerHealed = (data: {
            playerId: string;
            newHealth: number;
        }) => {
            if (data.playerId === socket.id) {
                setHealth(data.newHealth);
            }
        };

        const handleLobbyUpdated = (updatedLobby: Lobby) => {
            setCurrentLobby(updatedLobby);
            // Update our health from lobby state
            const currentPlayer = updatedLobby.players.find(
                (p) => p.id === socket.id,
            );
            if (currentPlayer) {
                setHealth(currentPlayer.health);
            }
        };

        socket.on("playerHit", handlePlayerHit);
        socket.on("playerHealed", handlePlayerHealed);
        socket.on("lobbyUpdated", handleLobbyUpdated);

        return () => {
            socket.off("playerHit", handlePlayerHit);
            socket.off("playerHealed", handlePlayerHealed);
            socket.off("lobbyUpdated", handleLobbyUpdated);
        };
    }, []);

    // Function to calculate color distance between two RGB colors
    const colorDistance = (
        color1: { r: number; g: number; b: number },
        color2: { r: number; g: number; b: number },
    ): number => {
        const dr = color1.r - color2.r;
        const dg = color1.g - color2.g;
        const db = color1.b - color2.b;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    };

    // Function to parse RGB color string to RGB object
    const parseRGBColor = (
        colorString: string,
    ): { r: number; g: number; b: number } | null => {
        const match = colorString.match(/rgb\((\d+),(\d+),(\d+)\)/);
        if (match) {
            return {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3]),
            };
        }
        return null;
    };

    // Function to find the closest matching player based on detected color
    const findClosestPlayerByColor = (detectedColor: string): Player | null => {
        if (!currentLobby) return null;

        const detectedRGB = parseRGBColor(detectedColor);
        if (!detectedRGB) return null;

        let closestPlayer: Player | null = null;
        let minDistance = Infinity;

        const otherPlayers = currentLobby.players;
        // Filter out the current player (can't shoot yourself)
        // const otherPlayers = currentLobby.players.filter(p => p.id !== socket.id);

        for (const player of otherPlayers) {
            // Try to get color from player's stored color properties first
            let playerColor: { r: number; g: number; b: number } | null = null;

            if (
                player.r !== undefined &&
                player.g !== undefined &&
                player.b !== undefined
            ) {
                playerColor = { r: player.r, g: player.g, b: player.b };
            }

            if (playerColor) {
                const distance = colorDistance(detectedRGB, playerColor);
                console.log(
                    `🎯 Color distance to ${player.name}:`,
                    distance,
                    `(detected: rgb(${detectedRGB.r},${detectedRGB.g},${detectedRGB.b}), player: rgb(${playerColor.r},${playerColor.g},${playerColor.b}))`,
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    closestPlayer = player;
                }
            }
        }

        if (closestPlayer) {
            console.log(
                `🎯 Closest color match: ${closestPlayer.name} (distance: ${minDistance})`,
            );
        } else {
            console.log(
                `🎯 No color match found for detected color: ${detectedColor}`,
            );
        }

        return closestPlayer;
    };

    function getTargetPrediction(
        predictions: cocoSsd.DetectedObject[],
    ): cocoSsd.DetectedObject[] {
        if (!canvasRef.current) return [];

        const cx = canvasRef.current.width / 2;
        const cy = canvasRef.current.height / 2;
        const results = [];
        for (const pred of predictions) {
            if (pred.class === "person" && pred.score > 0.5) {
                const [x, y, w, h] = pred.bbox;
                // Check if crosshair (cx, cy) is within bbox
                if (cx >= x && cx <= x + w && cy >= y && cy <= y + h) {
                    results.push(pred);
                }
            }
        }
        return results;
    }

    async function segmentShirtColor(
        video: HTMLVideoElement,
        bbox: number[],
    ): Promise<string | null> {
        if (!bodyPixNet || !video || !bbox) return null;

        const SMALL_WIDTH = 350;
        const SMALL_HEIGHT = 350;

        const [x, y, width, height] = bbox;

        // Define crop margins (adjust these values as needed)
        const CROP_MARGIN_X = width * 0.2; // Crop 20% from left/right edges
        const CROP_MARGIN_Y = height * 0.2; // Crop 20% from top/bottom edges

        // Calculate cropped region
        const croppedX = x + CROP_MARGIN_X;
        const croppedY = y + CROP_MARGIN_Y;
        const croppedWidth = width - 2 * CROP_MARGIN_X;
        const croppedHeight = height - 2 * CROP_MARGIN_Y;

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = SMALL_WIDTH;
        tempCanvas.height = SMALL_HEIGHT;
        const tempCtx = tempCanvas.getContext("2d");

        if (!tempCtx) return null;

        // Draw the cropped bounding box region, scaled down
        tempCtx.drawImage(
            video, // source
            croppedX,
            croppedY,
            croppedWidth,
            croppedHeight, // cropped source rect
            0,
            0,
            SMALL_WIDTH,
            SMALL_HEIGHT, // destination rect
        );

        // Rest of your segmentation code...
        const segmentation = await bodyPixNet.segmentPersonParts(tempCanvas, {
            internalResolution: "low",
            segmentationThreshold: 0.2,
            scoreThreshold: 0.2,
        });

        // Process results...
        console.log("Segmentation result:", segmentation);
        // Parts 12, 13 = torso
        const { data: partMap } = segmentation;
        console.log("Part map:", partMap);
        const uniqueParts = [...new Set(partMap)];
        console.log("Detected body parts:", uniqueParts);
        console.log("Looking for torso parts: 12 (torso_front), 13 (torso_back)");

        const imgData = tempCtx.getImageData(0, 0, SMALL_WIDTH, SMALL_HEIGHT);

        // Use Map to count color frequencies
        const colorFrequency = new Map();

        for (let i = 0; i < partMap.length; i++) {
            if (
                partMap[i] === 12 ||
                partMap[i] === 13 ||
                partMap[i] === 2 ||
                partMap[i] === 3 ||
                partMap[i] === 4 ||
                partMap[i] === 5
            ) {
                // Get pixel coordinates
                const segX = i % segmentation.width;
                const segY = Math.floor(i / segmentation.width);

                // Scale to canvas coordinates
                const canvasX = Math.floor((segX / segmentation.width) * SMALL_WIDTH);
                const canvasY = Math.floor((segY / segmentation.height) * SMALL_HEIGHT);

                const pixelIndex = (canvasY * SMALL_WIDTH + canvasX) * 4;

                if (pixelIndex < imgData.data.length) {
                    const r = imgData.data[pixelIndex];
                    const g = imgData.data[pixelIndex + 1];
                    const b = imgData.data[pixelIndex + 2];

                    // Quantize colors to reduce noise (group similar colors together)
                    const quantizedR = Math.round(r / 16) * 16; // Reduce to 16 levels
                    const quantizedG = Math.round(g / 16) * 16;
                    const quantizedB = Math.round(b / 16) * 16;

                    const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;

                    if (colorFrequency.has(colorKey)) {
                        colorFrequency.set(colorKey, colorFrequency.get(colorKey) + 1);
                    } else {
                        colorFrequency.set(colorKey, 1);
                    }
                }
            }
        }

        if (colorFrequency.size > 0) {
            // Find the mode (most frequent color)
            let maxCount = 0;
            let modeColor = null;

            for (const [colorKey, count] of colorFrequency.entries()) {
                if (count > maxCount) {
                    maxCount = count;
                    const [r, g, b] = colorKey.split(",").map(Number);
                    modeColor = { r, g, b };
                }
            }

            console.log(`Mode color found with ${maxCount} occurrences:`, modeColor);
            console.log(`Total unique colors: ${colorFrequency.size}`);

            return modeColor
                ? `rgb(${modeColor.r},${modeColor.g},${modeColor.b})`
                : null;
        } else {
            console.log("No torso pixels found");
            return null;
        }
    }

    const handleShoot = async () => {
        setRecoil(true);
        setTimeout(() => setRecoil(false), 100); // reset after 100ms

        const targets = getTargetPrediction(predictionsRef.current);
        if (targets.length > 0 && videoRef.current) {
            for (const target of targets) {
                console.log("🎯 Hit target:", target);
                const color = await segmentShirtColor(videoRef.current, target.bbox);
                console.log("🎨 Segmented shirt color:", color);

                if (color) {
                    // Find the closest player by color
                    const targetPlayer = findClosestPlayerByColor(color);
                    if (targetPlayer) {
                        console.log(
                            `🎯 Targeting ${targetPlayer.name} based on color match`,
                        );
                        socket.emit("playerShoot", {
                            targetPlayerId: targetPlayer.id,
                            lobbyCode: lobbyCode,
                            damage: 25,
                        });
                        break; // Only target the first matched player
                    }
                }
            }
        }

        const id = Date.now();
        setParticles((prev: Particle[]) => [...prev, { id }]);

        // Remove particle after 400ms
        setTimeout(() => {
            setParticles((prev: Particle[]) =>
                prev.filter((p: Particle) => p.id !== id),
            );
        }, 400);
    };

    // @ts-ignore
    const handleHeal = () => {
        if (lobbyCode) {
            socket.emit("healPlayer", {
                playerId: socket.id,
                lobbyCode: lobbyCode,
                healAmount: 25,
            });
        }
    };

    // Main game interface
    return (
        <div className="player-wrapper" onClick={handleShoot}>
            {/* Camera Debug Panel - only show if loading or in development */}
            {/* {(cameraLoading || process.env.NODE_ENV === 'development') && (
                <div style={{
                    position: 'fixed',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(0,0,0,0.8)',
                    color: 'white',
                    padding: '10px',
                    borderRadius: '5px',
                    fontSize: '12px',
                    zIndex: 1000,
                    fontFamily: 'monospace'
                }}>
                    <div>📊 Camera Debug</div>
                    <div>Stream: {cameraDebug.hasStream ? '✅' : '❌'}</div>
                    <div>Video Element: {cameraDebug.hasVideoElement ? '✅' : '❌'}</div>
                    <div>Dimensions: {cameraDebug.videoWidth}x{cameraDebug.videoHeight}</div>
                    <div>Ready State: {cameraDebug.readyState}</div>
                    <div>Camera Loading: {cameraLoading ? 'Yes' : 'No'}</div>
                    {cameraDebug.error && <div>Error: {cameraDebug.error}</div>}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            window.location.reload();
                        }}
                        style={{
                            marginTop: '5px',
                            padding: '2px 6px',
                            fontSize: '10px',
                            background: '#444',
                            color: 'white',
                            border: '1px solid #666',
                            borderRadius: '3px',
                            cursor: 'pointer'
                        }}
                    >
                        🔄 Retry
                    </button>
                </div>
            )} */}

            {/* Health Bar */}
            <div className="player-health-overlay">
                <div className="health-bar-container">
                    <div className="health-labels">
                        <span>Health</span>
                        <span>
                            {health}/{maxHealth}
                        </span>
                    </div>
                    <div className="health-bar-track">
                        <div
                            className="health-bar-fill"
                            style={{ width: `${(health / maxHealth) * 100}%` }}
                        ></div>
                    </div>
                </div>
                {/* <button
                    className="heal-button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleHeal();
                    }}
                    disabled={health >= maxHealth}
                >
                    Heal (+25)
                </button> */}
            </div>

            {/* Debug panel for testing health system */}
            {currentLobby?.state === "active" && (
                <div className="debug-panel">
                    <h3>Debug Controls</h3>

                    {/* Player Colors Display */}
                    <div style={{ marginBottom: "15px" }}>
                        <h4
                            style={{
                                color: "white",
                                margin: "0 0 10px 0",
                                fontSize: "0.9rem",
                            }}
                        >
                            Player Colors:
                        </h4>
                        {currentLobby.players.map((player) => (
                            <div
                                key={player.id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    marginBottom: "5px",
                                    fontSize: "0.8rem",
                                }}
                            >
                                <div
                                    style={{
                                        width: "16px",
                                        height: "16px",
                                        backgroundColor:
                                            player.r !== undefined
                                                ? `rgb(${player.r},${player.g},${player.b})`
                                                : "#666",
                                        marginRight: "8px",
                                        border: "1px solid white",
                                        borderRadius: "2px",
                                    }}
                                />
                                <span style={{ color: "white" }}>
                                    {player.name} {player.id === socket.id ? "(You)" : ""}
                                    {player.r !== undefined &&
                                        ` - rgb(${player.r},${player.g},${player.b})`}
                                </span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (lobbyCode && currentLobby) {
                                // Simulate taking damage
                                const randomPlayer =
                                    currentLobby?.players[
                                    Math.floor(Math.random() * currentLobby.players.length)
                                    ];
                                if (randomPlayer) {
                                    socket.emit("playerShoot", {
                                        targetPlayerId: randomPlayer.id,
                                        lobbyCode: lobbyCode,
                                        damage: 25,
                                    });
                                }
                            }
                        }}
                        className="debug-button"
                    >
                        Simulate Hit (Random Player)
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (lobbyCode) {
                                socket.emit("resetPlayerHealth", {
                                    playerId: socket.id,
                                    lobbyCode: lobbyCode,
                                });
                            }
                        }}
                        className="debug-button"
                    >
                        Reset My Health
                    </button>
                </div>
            )}

            {/* Video stream and canvas for object detection */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="player-video"
                style={{
                    background: "#000",
                    display: "block", // Ensure video is visible
                }}
            />
            <canvas ref={canvasRef} className="player-canvas" />

            {/* Gun overlay */}
            <div className="gun-overlay">
                <img
                    src="./gun.png"
                    alt="Gun"
                    className={`gun-image ${recoil ? "shoot-recoil" : ""}`}
                />
            </div>

            {/* Shoot particles */}
            {particles.map((particle) => (
                <div key={particle.id} className="shoot-particle" />
            ))}

            {/* Camera status indicator - show loading or error states */}
            {(cameraLoading || error) && !videoRef.current?.srcObject && (
                <div
                    style={{
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
                    }}
                >
                    {error ? (
                        <>
                            <div>❌ {error}</div>
                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    marginTop: "1rem",
                                    padding: "0.5rem 1rem",
                                    background: "#cc241d",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                }}
                            >
                                Try Again
                            </button>
                        </>
                    ) : (
                        <>
                            <div>📹 Setting up Camera...</div>
                            <div style={{ fontSize: "0.8rem", marginTop: "10px" }}>
                                Please allow camera access when prompted
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
