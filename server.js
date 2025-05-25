// server.js (WebSocket Server)
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const games = {};

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    const data = JSON.parse(message);
    const { type, gameId, move } = data;

    if (type === 'join') {
      if (!games[gameId]) {
        games[gameId] = [ws];
      } else if (games[gameId].length === 1) {
        games[gameId].push(ws);
        games[gameId].forEach((client, idx) => {
          client.send(JSON.stringify({ type: 'start', player: idx === 0 ? 'X' : 'O' }));
        });
      }
    } else if (type === 'move') {
      if (games[gameId]) {
        games[gameId].forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'move', move }));
          }
        });
      }
    }
  });
});

console.log('WebSocket server running on ws://localhost:8080');
