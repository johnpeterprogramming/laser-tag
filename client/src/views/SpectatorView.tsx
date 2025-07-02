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
    const location = useLocation();
    const { lobby } = (location.state as LocationState) || {};
    const [currentLobby, setCurrentLobby] = useState<Lobby | undefined>(lobby);
    useEffect(() => {
        if (lobby) {
            socket.on("lobbyUpdated", (updatedLobby: Lobby) => {
                setCurrentLobby(updatedLobby);
            });
            return () => {
                socket.off("lobbyUpdated");
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

    return (
        <div className="spectator-dashboard-container">
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
                    currentLobby.players.map((p: any) => {
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
                    <div style={{ color: '#b57614', fontWeight: 500, textAlign: 'center', gridColumn: '1/-1' }}>No players in lobby</div>
                )}
            </main>
        </div>
    );
}
