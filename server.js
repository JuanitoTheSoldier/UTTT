// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const games = new Map(); // gameId -> [player1, player2]

wss.on('connection', (ws) => {
  let currentGameId = null;

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error('Invalid JSON:', message);
      return;
    }

    if (data.type === 'host') {
      const gameId = Math.random().toString(36).substring(2, 8);
      games.set(gameId, [ws]);
      currentGameId = gameId;
      ws.send(JSON.stringify({ type: 'hosted', gameId }));
      console.log(`Game hosted: ${gameId}`);
    }

    else if (data.type === 'join') {
      const game = games.get(data.gameId);
      if (game && game.length === 1) {
        game.push(ws);
        currentGameId = data.gameId;

        // Inform both players the game has started
        game[0].send(JSON.stringify({ type: 'start', player: 1 }));
        game[1].send(JSON.stringify({ type: 'start', player: 2 }));
        console.log(`Player joined game ${data.gameId}`);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid or full game ID' }));
      }
    }

    else if (data.type === 'move') {
      const game = games.get(currentGameId);
      if (game) {
        game.forEach(player => {
          if (player !== ws && player.readyState === WebSocket.OPEN) {
            player.send(JSON.stringify({ type: 'move', move: data.move }));
          }
        });
      }
    }
  });

  ws.on('close', () => {
    if (currentGameId && games.has(currentGameId)) {
      const game = games.get(currentGameId);
      games.delete(currentGameId);
      game.forEach(player => {
        if (player !== ws && player.readyState === WebSocket.OPEN) {
          player.send(JSON.stringify({ type: 'error', message: 'Opponent disconnected' }));
        }
      });
      console.log(`Game ${currentGameId} ended due to disconnect`);
    }
  });
});

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Railway will assign a dynamic port
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
