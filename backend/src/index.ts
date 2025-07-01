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
type Player = { id: string, name: string };
type Lobby = {
  players: Player[];
  state: 'waiting' | 'active' | 'ended';
};

const lobbies: Record<string, Lobby> = {};

io.on('connection', (socket: Socket) => {
  console.log("A user connected");

  socket.on('createLobby', ({ playerName, lobbyCode }) => {
    lobbies[lobbyCode] = {
      state: 'waiting',
      players: [{ id: socket.id, name: playerName }],
    };
    socket.join(lobbyCode);

    io.to(lobbyCode).emit('lobbyUpdated', lobbies[lobbyCode]);

    console.log("Lobby with name: " + lobbyCode + " created by " + playerName + " . Lobby updated.");
  });

    // Join lobby
  socket.on('joinLobby', ({ playerName, lobbyCode }) => {
    const lobby = lobbies[lobbyCode];
    if (!lobby) {
      socket.emit('error', 'Lobby not found');
      return;
    }
    lobby.players.push({ id: socket.id, name: playerName });
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
  });
});

server.listen(port, () => {
  console.log(`Server listening at http://0.0.0.0:${port}`);
});

// Debug: Log lobbies every 5 seconds
// setInterval(() => {
//   console.log('Current lobbies:', JSON.stringify(lobbies, null, 2));
// }, 5000);

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