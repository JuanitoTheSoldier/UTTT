const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const games = new Map(); // gameId -> { players: [ws, ws], ... }

function makeGameId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    const { type } = data;

    if (type === 'host') {
      const gameId = makeGameId();
      ws.gameId = gameId;
      ws.symbol = 'X';

      games.set(gameId, { players: [ws] });

      ws.send(JSON.stringify({ type: 'hosted', gameId }));

      console.log(`Game hosted with ID ${gameId}`);

    } else if (type === 'join') {
      const { gameId } = data;
      const game = games.get(gameId);

      if (!game) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
        return;
      }

      if (game.players.length >= 2) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game full' }));
        return;
      }

      ws.gameId = gameId;
      ws.symbol = 'O';

      game.players.push(ws);

      // Notify both players game is starting
      game.players.forEach((player) => {
        if (player.readyState === WebSocket.OPEN) {
          player.send(JSON.stringify({ type: 'start' }));
        }
      });

      console.log(`Player joined game ${gameId}`);

    } else if (type === 'move') {
      const { boardIndex, cellIndex } = data;
      const gameId = ws.gameId;
      const game = games.get(gameId);

      if (!game) return;

      const symbol = ws.symbol;
      // Broadcast move to both players
      game.players.forEach((player) => {
        if (player.readyState === WebSocket.OPEN) {
          player.send(JSON.stringify({
            type: 'move',
            boardIndex,
            cellIndex,
            symbol
          }));
        }
      });
    }
  });

  ws.on('close', () => {
    // Clean up game if player disconnects
    if (!ws.gameId) return;
    const game = games.get(ws.gameId);
    if (!game) return;

    game.players = game.players.filter(p => p !== ws);
    if (game.players.length === 0) {
      games.delete(ws.gameId);
      console.log(`Game ${ws.gameId} deleted due to no players.`);
    }
  });
});

console.log('WebSocket server running on ws://localhost:8080');
