import { Routes, Route } from 'react-router-dom'
import PlayerView from './views/PlayerView'
import SpectatorView from './views/SpectatorView'
import StartPage from './views/StartPage';
import LobbyPage from './views/LobbyPage';


export default function App() {
    return (
        <Routes>
            <Route path="/" element={<StartPage />} />
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/player" element={<PlayerView />} />
            <Route path="/spectator" element={<SpectatorView />} />
        </Routes>
    )
}
