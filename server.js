const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });

let games = {}; // gameId -> { host: ws, guest: ws }

function generateGameId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    if (data.type === 'host') {
      const gameId = generateGameId();
      games[gameId] = { host: ws, guest: null };
      ws.gameId = gameId;
      ws.isHost = true;

      // Send back the hosted event with the game ID
      ws.send(JSON.stringify({ type: 'hosted', gameId }));
      console.log(`Game hosted with ID: ${gameId}`);

    } else if (data.type === 'join') {
      const game = games[data.gameId];
      if (game && !game.guest) {
        game.guest = ws;
        ws.gameId = data.gameId;
        ws.isHost = false;

        // Notify both players the game is starting
        game.host.send(JSON.stringify({ type: 'start' }));
        game.guest.send(JSON.stringify({ type: 'start' }));

        console.log(`Player joined game: ${data.gameId}`);

      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid game ID or game full' }));
      }

    } else if (data.type === 'move') {
      // Broadcast move to the other player
      const game = games[ws.gameId];
      if (!game) return;

      const other = ws.isHost ? game.guest : game.host;
      if (other && other.readyState === WebSocket.OPEN) {
        other.send(JSON.stringify({
          type: 'move',
          boardIndex: data.boardIndex,
          cellIndex: data.cellIndex,
          symbol: ws.isHost ? 'X' : 'O'
        }));
      }
    }
  });

  ws.on('close', () => {
    if (!ws.gameId) return;
    const game = games[ws.gameId];
    if (!game) return;

    // Close both sockets and delete the game on disconnect
    if (game.host && game.host !== ws) game.host.close();
    if (game.guest && game.guest !== ws) game.guest.close();
    delete games[ws.gameId];
    console.log(`Game ${ws.gameId} closed`);
  });
});

console.log('WebSocket server started on ws://localhost:3000');
