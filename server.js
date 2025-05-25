const http = require('http');
const WebSocket = require('ws');

const server = http.createServer();

const wss = new WebSocket.Server({ noServer: true });

const games = new Map();

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

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
