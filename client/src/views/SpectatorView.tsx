import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { socket } from "../socket";
import "./SpectatorView.css";

interface Player {
    id: string;
    name: string;
    health: number;
    maxHealth?: number;
    colour?: string;
    isSpectator?: boolean;
    r?: number;
    g?: number;
    b?: number;
}

interface Lobby {
    code: string;
    players: Player[];
    state: string;
}

interface LocationState {
    lobby: Lobby;
}

import { useRef } from "react";
export default function SpectatorView() {
    const location = useLocation();
    const { lobby } = (location.state as LocationState) || {};
    const [currentLobby, setCurrentLobby] = useState<Lobby | undefined>(lobby);
    const [gameEnded, setGameEnded] = useState(false);
    const [winner, setWinner] = useState<Player | null>(null);
    const [gameStartTime, setGameStartTime] = useState<number | null>(null);
    const [gameEndTime, setGameEndTime] = useState<number | null>(null);
    const startAudioRef = useRef<HTMLAudioElement>(null);
    const winnerAudioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (lobby) {
            socket.on("lobbyUpdated", (updatedLobby: Lobby) => {
                setCurrentLobby(updatedLobby);
            });
            // Listen for game start to record start time (no sound here)
            socket.on("gameStarted", () => {
                setGameStartTime(Date.now());
                setGameEnded(false);
                setWinner(null);
                setGameEndTime(null);
            });
            socket.on("gameEnded", (data: { winner: Player; lobbyCode: string }) => {
                setGameEnded(true);
                setWinner(data.winner);
                setGameEndTime(Date.now());
                if (winnerAudioRef.current) {
                    try {
                        winnerAudioRef.current.volume = 0.6;
                        winnerAudioRef.current.currentTime = 0;
                        winnerAudioRef.current.play();
                    } catch (e) {}
                }
            });
            return () => {
                socket.off("lobbyUpdated");
                socket.off("gameStarted");
                socket.off("gameEnded");
            };
        }
    }, [lobby]);

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


    // Winner popup (bouncing, slow)
    let gameDuration = null;
    if (gameStartTime && gameEndTime) {
        const ms = gameEndTime - gameStartTime;
        const min = Math.floor(ms / 60000);
        const sec = Math.floor((ms % 60000) / 1000);
        gameDuration = `${min > 0 ? min + 'm ' : ''}${sec}s`;
    }

    const winnerPopup = gameEnded ? (
        <div className="winner-popup-bounce">
            <div className="winner-popup-content">
                <div className="winner-icon">🏆</div>
                <div className="winner-title">
                    {winner?.name ? `${winner.name} WINS!` : "VICTORY!"}
                </div>
                <div className="winner-subtitle">
                    {winner?.name ? `Congratulations to ${winner.name}!` : "Game Over"}
                </div>
                {gameDuration && (
                    <div className="winner-duration" style={{marginTop:8, color:'#b8bb26', fontWeight:600, fontSize:'1.05em'}}>
                        Game Duration: {gameDuration}
                    </div>
                )}
            </div>
        </div>
    ) : null;

    return (
        <div className="spectator-dashboard-container">
            {/* Winner popup at the bottom, bouncing slowly */}
            {winnerPopup}
            {/* Audio elements for sounds */}
            <audio ref={startAudioRef} src="/start.wav" preload="auto" />
            <audio ref={winnerAudioRef} src="/winner.mp3" preload="auto" />
            <header className="dashboard-header live-header">
                <h1>
                  <span className="live-dot"></span>
                  <span className="live-text">LIVE</span>
                  <span className="live-title">Spectator Dashboard</span>
                </h1>
                <div className="lobby-state">Lobby State: <span>{currentLobby?.state || "Unknown"}</span></div>
            </header>
            <main className="dashboard-main-grid">
                {currentLobby?.players && currentLobby.players.length > 0 ? (
                    currentLobby.players
                        .filter((p: any) => !p.isSpectator) // Filter out spectators
                        .map((p: any) => {
                        // Use RGB color for avatar border and color dot
                        const rgb = (typeof p.r === 'number' && typeof p.g === 'number' && typeof p.b === 'number')
                            ? `rgb(${p.r},${p.g},${p.b})`
                            : '#b8bb26';
                        return (
                            <div className="dashboard-player-card" key={p.id}>
                                <div className="player-avatar-row">
                                    <img
                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=222b3a&color=fff&size=48`}
                                        alt={p.name}
                                        className="player-avatar"
                                        style={{ border: `2px solid ${rgb}` }}
                                    />
                                    <span className="player-name">{p.name}</span>
                                </div>
                                <div className="player-info-row">
                                    <span className="player-colour-label">Colour</span>
                                    <span className="player-colour-dot" style={{ background: rgb }}></span>
                                </div>
                                <div className="player-info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                                    <span className="player-health-label">Health</span>
                                    <div className="health-bar-spectator" style={{ width: '100%', maxWidth: 120, height: 14, background: '#d5c4a1', borderRadius: 8, marginTop: 4, marginBottom: 2, boxShadow: 'inset 0 2px 4px rgba(60,56,54,0.18)' }}>
                                        <div
                                            className="health-bar-fill-spectator"
                                            style={{
                                                width: `${(p.health / (p.maxHealth || 100)) * 100}%`,
                                                height: '100%',
                                                background: '#cc241d',
                                                borderRadius: 8,
                                                transition: 'width 0.3s',
                                            }}
                                        ></div>
                                    </div>
                                    <span className="player-health-value" style={{ color: '#cc241d', fontWeight: 'bold', fontSize: '0.98em' }}>{p.health}{typeof p.maxHealth === 'number' ? `/${p.maxHealth}` : ''}</span>
                                </div>
                                {p.health === 0 && (
                                    <div className="player-state-row" style={{ marginTop: 12, width: '100%', display: 'flex', justifyContent: 'center' }}>
                                        <span className="player-state-label" style={{
                                            background: '#cc241d',
                                            color: '#fff',
                                            borderRadius: 8,
                                            padding: '4px 16px',
                                            fontWeight: 700,
                                            fontSize: '1.05em',
                                            letterSpacing: 1,
                                            boxShadow: '0 0 8px #cc241d',
                                            border: '2px solid #cc241d',
                                            textTransform: 'uppercase',
                                            transition: 'all 0.2s',
                                        }}>Eliminated</span>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div style={{ color: '#b57614', fontWeight: 500, textAlign: 'center', gridColumn: '1/-1' }}>
                        {currentLobby?.players && currentLobby.players.length > 0 
                            ? "No active players (only spectators in lobby)" 
                            : "No players in lobby"}
                    </div>
                )}
            </main>
        </div>
    );
/* Winner popup bounce animation styles */
/* Add this to SpectatorView.css or your global CSS */
/*
.winner-popup-bounce {
  position: fixed;
  bottom: 40px;
  right: 40px;
  z-index: 9999;
  animation: bounce 3.5s infinite alternate cubic-bezier(.5,1.8,.5,1);
}
.winner-popup-content {
  background: #222b3a;
  color: #fff;
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 3px solid #cc241d;
}
.winner-popup-content .winner-icon {
  font-size: 2.5em;
  margin-bottom: 8px;
}
.winner-popup-content .winner-title {
  font-size: 1.5em;
  font-weight: bold;
  margin-bottom: 4px;
}
.winner-popup-content .winner-subtitle {
  font-size: 1.1em;
  color: #fabd2f;
}
@keyframes bounce {
  0% { transform: translateY(0); }
  100% { transform: translateY(-30px); }
}
*/
}
