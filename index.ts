import express, { Request, Response } from "express";
import http from "http";
import dotenv from "dotenv";
import { Server, Socket } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const port = process.env.PORT || 8080;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: true, // TODO: change to use environment variable for production
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"]
    }
});

// Serve built React app from build directory
const buildPath = path.join(__dirname, 'build');
app.use(express.static(buildPath));

// Handle React Router routes - send all non-API requests to React
app.get(/^(?!\/api).*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});

// Simple test route for API
app.get('/api/test', (_req: Request, res: Response) => {
    res.json({ message: "Laser Tag Server is running!" });
});

// Socket logic : TODO: reduce duplication, same type is used for frontend
type Player = { id: string, name: string, isHost: boolean, health: number, maxHealth: number, r?: number, g?: number, b?: number };
type Lobby = {
    code: string,
    players: Player[];
    state: 'waiting' | 'active' | 'ended';
};

const lobbies: Record<string, Lobby> = {};

// Hardcoded color mappings for players (RGB values) - matching client-side
const playerColors: Record<string, { r: number; g: number; b: number }> = {
    'Player1': { r: 96, g: 96, b: 80 },     // green
    'Player2': { r: 48, g: 48, b: 48 },     // black
    'Player3': { r: 64, g: 96, b: 128 },    // blue
    'Player4': { r: 178, g: 34, b: 34 },    // red/white
};

// Function to get color for a player based on their name
// TODO assign based on lobby colour
const getPlayerColor = (playerName: string, isHost: boolean = false) => {
    if (isHost) {
        // Host gets the specific green color
        return { r: 96, g: 96, b: 80 };
    }

    // Try to get color from hardcoded mapping first
    const hardcodedColor = playerColors[playerName];
    if (hardcodedColor) {
        return hardcodedColor;
    }

    // Fallback colors for other players
    const fallbackColors = [
        { r: 48, g: 48, b: 48 },     // black
        { r: 50, g: 50, b: 180 },    // blue  
        { r: 178, g: 34, b: 34 },    // red
        { r: 255, g: 255, b: 0 },    // yellow
        { r: 255, g: 0, b: 255 },    // magenta
        { r: 0, g: 255, b: 255 },    // cyan
        { r: 255, g: 165, b: 0 },    // orange
        { r: 128, g: 0, b: 128 },    // purple
    ];

    // Use player name hash to get consistent color
    const hash = playerName.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);

    return fallbackColors[Math.abs(hash) % fallbackColors.length];
};

io.on('connection', (socket: Socket) => {
    console.log("A user connected");

    // Create lobby
    socket.on('createLobby', ({ playerName, lobbyCode }) => {
        // Check if lobby already exists
        if (lobbies[lobbyCode]) {
            socket.emit('createLobbyResponse', {
                success: false,
                message: 'Lobby code already exists. Please choose a different code.',
                lobby: null
            });
            return;
        }

        // Validate lobby code (6 characters, alphanumeric)
        if (!lobbyCode || lobbyCode.length !== 6 || !/^[A-Z0-9]+$/.test(lobbyCode)) {
            socket.emit('createLobbyResponse', {
                success: false,
                message: 'Lobby code must be exactly 6 alphanumeric characters',
                lobby: null
            });
            return;
        }

        // Success - create lobby
        lobbies[lobbyCode] = {
            code: lobbyCode,
            state: 'waiting',
            players: [{
                id: socket.id,
                name: playerName,
                isHost: true,
                health: 100,
                maxHealth: 100,
                ...getPlayerColor(playerName, true) // Assign host color
            }],
        };


        // Send success response
        socket.emit('createLobbyResponse', {
            success: true,
            message: 'Lobby created successfully',
            lobby: lobbies[lobbyCode]
        });

        socket.join(lobbyCode);
        io.to(lobbyCode).emit('lobbyUpdated', lobbies[lobbyCode]);
    });

    // Join lobby
    socket.on('joinLobby', ({ playerName, lobbyCode }) => {
        const lobby = lobbies[lobbyCode];

        // Check if lobby exists
        if (!lobby) {
            socket.emit('joinLobbyResponse', {
                success: false,
                message: 'Lobby not found',
                lobby: null
            });
            return;
        }

        // Check if player already exists in lobby
        const existingPlayer = lobby.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
        if (existingPlayer) {
            socket.emit('joinLobbyResponse', {
                success: false,
                message: 'Username already taken in this lobby',
                lobby: null
            });
            return;
        }

        // Check if lobby limit has been reached
        if (lobby.players.length >= 20) {
            socket.emit('joinLobbyResponse', {
                success: false,
                message: 'Lobby is full (max 20 players)',
                lobby: null
            });
            return;
        }

        // Check if lobby is still waiting (not active/ended)
        if (lobby.state !== 'waiting') {
            socket.emit('joinLobbyResponse', {
                success: false,
                message: 'Lobby is no longer accepting players',
                lobby: null
            });
            return;
        }

        lobby.players.push({
            id: socket.id,
            name: playerName,
            isHost: false,
            health: 100,
            maxHealth: 100,
            ...getPlayerColor(playerName, false) // Assign color based on name
        });


        // Can join lobby
        socket.emit('joinLobbyResponse', {
            success: true,
            message: 'Successfully joined lobby',
            lobby: lobby
        });

        socket.join(lobbyCode);
        io.to(lobbyCode).emit('lobbyUpdated', lobby);
    });

    // Join room (for players transitioning between views)
    socket.on('joinRoom', ({ lobbyCode }) => {
        socket.join(lobbyCode);
    });

    // Handle player shooting
    socket.on('playerShoot', ({ targetPlayerId, lobbyCode, damage = 25 }) => {
        const lobby = lobbies[lobbyCode];
        if (!lobby) return;

        const shooter = lobby.players.find(p => p.id === socket.id);
        const target = lobby.players.find(p => p.id === targetPlayerId);

        if (!shooter || !target) return;

        // Apply damage
        target.health = Math.max(0, target.health - damage);

        // Notify all players in the lobby
        io.to(lobbyCode).emit('playerHit', {
            shooterId: shooter.id,
            targetId: target.id,
            damage: damage,
            targetHealth: target.health,
            isKilled: target.health === 0
        });

        // Update lobby state
        io.to(lobbyCode).emit('lobbyUpdated', lobby);
    });

    // Handle player healing
    socket.on('healPlayer', ({ playerId, lobbyCode, healAmount = 25 }) => {
        const lobby = lobbies[lobbyCode];
        if (!lobby) return;

        const player = lobby.players.find(p => p.id === playerId);
        if (!player) return;

        // Apply healing
        player.health = Math.min(player.maxHealth, player.health + healAmount);

        // Notify all players in the lobby
        io.to(lobbyCode).emit('playerHealed', {
            playerId: player.id,
            healAmount: healAmount,
            newHealth: player.health
        });

        // Update lobby state
        io.to(lobbyCode).emit('lobbyUpdated', lobby);
    });

    // Reset player health
    socket.on('resetPlayerHealth', ({ playerId, lobbyCode }) => {
        const lobby = lobbies[lobbyCode];
        if (!lobby) return;

        const player = lobby.players.find(p => p.id === playerId);
        if (!player) return;

        player.health = player.maxHealth;

        // Notify all players in the lobby
        io.to(lobbyCode).emit('playerHealed', {
            playerId: player.id,
            healAmount: player.maxHealth,
            newHealth: player.health
        });

        // Update lobby state
        io.to(lobbyCode).emit('lobbyUpdated', lobby);
    });

    // Start game
    socket.on('startGame', ({ lobbyCode }) => {
        const lobby = lobbies[lobbyCode];
        if (!lobby) {
            socket.emit('startGameResponse', {
                success: false,
                message: 'Lobby not found'
            });
            return;
        }

        const host = lobby.players.find(p => p.isHost);
        if (!host || host.id !== socket.id) {
            socket.emit('startGameResponse', {
                success: false,
                message: 'Only the host can start the game'
            });
            return;
        }

        if (lobby.players.length < 2) {
            socket.emit('startGameResponse', {
                success: false,
                message: 'Need at least 2 players to start'
            });
            return;
        }

        // Start the game
        lobby.state = 'active';

        // Reset all players health
        lobby.players.forEach(player => {
            player.health = player.maxHealth;
        });

        socket.emit('startGameResponse', {
            success: true,
            message: 'Game started successfully'
        });

        // Notify all players in lobby that game has started
        console.log(`Game started for lobby ${lobbyCode}. Notifying ${lobby.players.length} players.`);
        io.to(lobbyCode).emit('gameStarted', lobby);
        io.to(lobbyCode).emit('lobbyUpdated', lobby);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');

        // Leave current lobby
        for (const lobbyCode in lobbies) {
            const lobby = lobbies[lobbyCode];
            const index = lobby.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                lobby.players.splice(index, 1);
                io.to(lobbyCode).emit('lobbyUpdated', lobby);
            }
        }

        // If no players in lobby - delete lobby
        for (const lobbyCode in lobbies) {
            const lobby = lobbies[lobbyCode];
            if (lobby.players.length == 0)
                delete lobbies[lobbyCode];
        }

    });
});

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});


// Graceful shutdown function
const gracefulShutdown = (signal: string) => {
    console.log(`${signal} received, shutting down gracefully`);
    server.close((err?: Error) => {
        if (err) {
            console.error('Error closing server:', err);
            process.exit(1);
        }
        console.log('Server closed');

        // Close Socket.IO server
        io.close(() => {
            console.log('Socket.IO server closed');
            process.exit(0);
        });
    });

    // Force close after timeout
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));