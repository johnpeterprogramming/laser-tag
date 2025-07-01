import express from "express";

import dotenv from "dotenv";
dotenv.config();

const port = process.env.PORT || 8080;

const app = express();

const http = require('http');
const server = http.createServer(app);
import { Server, Socket } from "socket.io";

const io = new Server(server, {
  cors: {
    origin: true, // Allow all origins in development
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});

// I think we can remove this. Will only make use of sockets for communication
app.get("/api", (req, res) => {
  res.json({ message: "TEST API IS WORKING!" });
});


// Socket logic : TODO: reduce duplication, same type is used for frontend
type Player = { id: string, name: string, isHost: boolean };
type Lobby = {
  code: string,
  players: Player[];
  state: 'waiting' | 'active' | 'ended';
};

const lobbies: Record<string, Lobby> = {};

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
      players: [{ id: socket.id, name: playerName, isHost: true }],
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

    lobby.players.push({ id: socket.id, name: playerName, isHost: false });

    // Can join lobby
    socket.emit('joinLobbyResponse', {
      success: true,
      message: 'Successfully joined lobby',
      lobby: lobby
    });

    socket.join(lobbyCode);
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
  console.log(`Server listening at http://0.0.0.0:${port}`);
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