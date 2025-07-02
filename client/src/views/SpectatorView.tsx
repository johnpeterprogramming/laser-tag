import { useRef, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { socket } from "../socket";
import "./SpectatorView.css";

interface Player {
    id: string;
    name: string;
    health: number;
    maxHealth?: number;
}

interface Lobby {
    code: string;
    players: Player[];
    state: string;
}

interface LocationState {
    lobby: Lobby;
}

export default function SpectatorView() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);
    const location = useLocation();
    const { lobby } = (location.state as LocationState) || {};
    const [currentLobby, setCurrentLobby] = useState<Lobby | undefined>(lobby);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [gameEnded, setGameEnded] = useState<boolean>(false);
    const [winner, setWinner] = useState<Player | null>(null);

    // Select first player by default
    useEffect(() => {
        if (currentLobby?.players && currentLobby.players.length > 0 && !selectedPlayer) {
            setSelectedPlayer(currentLobby.players[0]);
        }
    }, [currentLobby, selectedPlayer]);

    // Listen for lobby updates
    useEffect(() => {
        if (lobby) {
            socket.on("lobbyUpdated", (updatedLobby: Lobby) => {
                setCurrentLobby(updatedLobby);
                // Update selected player if they still exist
                if (selectedPlayer) {
                    const updatedPlayer = updatedLobby.players.find(p => p.id === selectedPlayer.id);
                    if (updatedPlayer) {
                        setSelectedPlayer(updatedPlayer);
                    } else {
                        // Player left, select first available player
                        setSelectedPlayer(updatedLobby.players[0] || null);
                    }
                }
            });

            socket.on("gameEnded", (data: { winner: Player; lobbyCode: string }) => {
                console.log("Game ended! Winner:", data.winner.name);
                setGameEnded(true);
                setWinner(data.winner);
            });

            return () => {
                socket.off("lobbyUpdated");
                socket.off("gameEnded");
            };
        }
    }, [lobby, selectedPlayer]);

    // Player details from selected player or default
    const player = selectedPlayer || {
        name: "No Player Selected",
        health: 0,
        maxHealth: 100,
        id: ""
    };

    // Get camera stream
    useEffect(() => {
        let activeStream: MediaStream;

        const enableCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" },
                });
                activeStream = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Camera error:", err);
                setError("Unable to access camera. Please enable it in your browser.");
            }
        };

        enableCamera();

        return () => {
            if (activeStream) {
                activeStream.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    // Fix for 100vh on mobile
    useEffect(() => {
        const setVH = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty("--vh", `${vh}px`);
        };

        setVH();
        window.addEventListener("resize", setVH);
        return () => window.removeEventListener("resize", setVH);
    }, []);

    return (
        <div className="spectator-container">
            <h1 className="title">Spectator View</h1>

            {currentLobby?.players && currentLobby.players.length > 0 && (
                <div className="player-selector">
                    <label>Watching: </label>
                    <select
                        value={selectedPlayer?.id || ""}
                        onChange={(e) => {
                            const playerId = e.target.value;
                            const player = currentLobby?.players?.find(p => p.id === playerId);
                            setSelectedPlayer(player || null);
                        }}
                    >
                        {currentLobby.players.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {error ? (
                <div className="error-message">{error}</div>
            ) : (
                <div className="video-wrapper">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="camera-video"
                    />
                    <div className="overlay-info">
                        <div className="health-bar-container">
                            <div className="health-labels">
                                <span>Health</span>
                                <span>{player.health}/{player.maxHealth || 100}</span>
                            </div>
                            <div className="health-bar-track">
                                <div
                                    className="health-bar-fill"
                                    style={{ width: `${((player.health || 0) / (player.maxHealth || 100)) * 100}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="player-details">
                            <p className="player-name">{player.name}</p>
                            <p className="player-status">
                                Status: {player.health > 0 ? "Alive" : "Eliminated"}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Winner Screen Overlay */}
            {gameEnded && (
                <div className="winner-overlay">
                    <div className="winner-content">
                        <div className="winner-icon">🏆</div>
                        <h1 className="winner-title">
                            {winner?.name} WINS!
                        </h1>
                        <p className="winner-subtitle">
                            Game Over! {winner?.name} is the last player standing!
                        </p>
                        <button
                            className="winner-button"
                            onClick={() => {
                                // Navigate back to start page
                                window.location.href = '/';
                            }}
                        >
                            Return to Lobby
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
