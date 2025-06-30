import { Routes, Route } from 'react-router-dom'
import PlayerView from './views/PlayerView'
import SpectatorView from './views/SpectatorView'
import StartPage from './views/StartPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/player" element={<PlayerView />} />
      <Route path="/spectator" element={<SpectatorView />} />
    </Routes>
  )
}
