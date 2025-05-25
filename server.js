const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const games = new Map(); // gameId -> { players: [wsX, wsO], state }

function generateGameId() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

wss.on('connection', (ws) => {
  ws.gameId = null;
  ws.symbol = null;

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    if (data.type === 'host') {
      let id;
      do {
        id = generateGameId();
      } while (games.has(id));
      games.set(id, {
        players: [ws, null],
        boardState: Array(9).fill(null).map(() => Array(9).fill(null)),
        boardWinners: Array(9).fill(null),
        currentPlayer: 'X',
        activeBoard: null,
      });
      ws.gameId = id;
      ws.symbol = 'X';
      ws.send(JSON.stringify({ type: 'hosted', gameId: id }));
    }

    else if (data.type === 'join') {
      const game = games.get(data.gameId);
      if (!game) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
        return;
      }
      if (game.players[1]) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game already full' }));
        return;
      }
      game.players[1] = ws;
      ws.gameId = data.gameId;
      ws.symbol = 'O';

      // Notify both players game started
      game.players.forEach((playerWs, i) => {
        if (playerWs && playerWs.readyState === WebSocket.OPEN) {
          playerWs.send(JSON.stringify({ type: 'start' }));
        }
      });
    }

    else if (data.type === 'move') {
      const game = games.get(ws.gameId);
      if (!game) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
        return;
      }
      if (ws.symbol !== game.currentPlayer) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
        return;
      }

      const { boardIndex, cellIndex } = data;

      // Validate move
      if (
        game.boardState[boardIndex][cellIndex] !== null ||
        (game.activeBoard !== null && game.activeBoard !== boardIndex) ||
        game.boardWinners[boardIndex] !== null
      ) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid move' }));
        return;
      }

      // Apply move
      game.boardState[boardIndex][cellIndex] = ws.symbol;

      // Check if micro board won
      const winner = checkWinner(game.boardState[boardIndex]);
      if (winner) {
        game.boardWinners[boardIndex] = winner;
      }

      // Check macro board winner
      const macroWinner = checkWinner(game.boardWinners);
      if (macroWinner) {
        // Inform both players game ended
        game.players.forEach(pws => {
          if (pws && pws.readyState === WebSocket.OPEN) {
            pws.send(JSON.stringify({ type: 'gameover', winner: macroWinner }));
          }
        });
        games.delete(ws.gameId);
        return;
      }

      // Determine next active board
      const nextBoardFilled = game.boardState[cellIndex].every(c => c !== null);
      game.activeBoard = (game.boardWinners[cellIndex] !== null || nextBoardFilled) ? null : cellIndex;

      // Switch player
      game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';

      // Broadcast move to both players
      game.players.forEach(pws => {
        if (pws && pws.readyState === WebSocket.OPEN) {
          pws.send(JSON.stringify({
            type: 'move',
            boardIndex,
            cellIndex,
            symbol: game.currentPlayer
          }));
        }
      });
    }
  });

  ws.on('close', () => {
    if (!ws.gameId) return;
    const game = games.get(ws.gameId);
    if (!game) return;

    // Remove player and end game if any disconnects
    games.delete(ws.gameId);
    game.players.forEach(pws => {
      if (pws && pws !== ws && pws.readyState === WebSocket.OPEN) {
        pws.send(JSON.stringify({ type: 'error', message: 'Opponent disconnected' }));
        pws.close();
      }
    });
  });
});

function checkWinner(cells) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (let [a,b,c] of lines) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return cells[a];
    }
  }
  return null;
}

console.log('WebSocket server running on ws://localhost:8080');
