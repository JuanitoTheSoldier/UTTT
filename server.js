const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

const games = new Map();

wss.on('connection', ws => {
  ws.on('message', msg => {
    const data = JSON.parse(msg);

    if (data.type === 'host') {
      const gameId = uuidv4().slice(0, 6);
      ws.mark = data.mark;
      games.set(gameId, { players: [ws], marks: [data.mark] });
      ws.send(JSON.stringify({ type: 'hosted', gameId }));
    }

    else if (data.type === 'join') {
      const game = games.get(data.gameId);
      if (!game || game.players.length >= 2) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid or full game ID.' }));
        return;
      }

      const otherMark = game.marks[0] === 'X' ? 'O' : 'X';
      ws.mark = otherMark;
      game.players.push(ws);
      game.marks.push(otherMark);

      game.players.forEach((p, i) => 
        p.send(JSON.stringify({ type: 'start', mark: game.marks[i] }))
      );
    }

    else if (data.type === 'move') {
      const game = [...games.values()].find(g => g.players.includes(ws));
      if (game) {
        game.players.forEach(p => {
          if (p !== ws) {
            p.send(JSON.stringify({ type: 'move', move: data.move }));
          }
        });
      }
    }
  });

  ws.on('close', () => {
    for (const [id, game] of games.entries()) {
      if (game.players.includes(ws)) {
        game.players.forEach(p => {
          if (p !== ws) p.send(JSON.stringify({ type: 'end', reason: 'opponent left' }));
        });
        games.delete(id);
      }
    }
  });
});
