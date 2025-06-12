const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map();

wss.on('connection', (ws) => {
  let roomCode = null;

  ws.on('message', (data, isBinary) => {
    try {
      const msg = JSON.parse(data.toString());
      if (!roomCode && msg.type && msg.room) {
        roomCode = msg.room;

        if (msg.type === 'create') {
          if (!rooms.has(roomCode)) {
            rooms.set(roomCode, new Set());

                // ✅ log เวลา + ห้อง
            console.log(`[${new Date().toLocaleTimeString()}] Room ${roomCode} created.`);

          }
        } else if (msg.type === 'join') {
          if (!rooms.has(roomCode)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room not found.' }));
            return;
          }
        }

        rooms.get(roomCode).add(ws);

        if (rooms.get(roomCode).size >= 2) {
          rooms.get(roomCode).forEach((client) => {
            if (client.readyState === client.OPEN) {
              client.send(JSON.stringify({ type: 'ready' }));
            }
          });
        }
        return;
      }

      const peers = rooms.get(roomCode) || new Set();
      for (const client of peers) {
        if (client !== ws && client.readyState === client.OPEN) {
          if (isBinary) {
            client.send(data, { binary: true });
          } else {
            client.send(data.toString());
          }
        }
      }
    } catch (e) {
      console.error('Invalid message received:', e);
    }
  });

  ws.on('close', () => {
    if (!roomCode) return;
    const peers = rooms.get(roomCode);
    if (!peers) return;

    peers.delete(ws);

    for (const client of peers) {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ type: 'peer-disconnected' }));
      }
    }

    if (peers.size === 0) {
      rooms.delete(roomCode);
      console.log(`Room ${roomCode} deleted`);
    }
  });
});

app.use(express.static('public'));

// ✅ เพิ่มส่วนนี้เพื่อให้เช็คห้องก่อน join ได้
app.get('/check-room/:code', (req, res) => {
  const code = req.params.code;
  res.json({ exists: rooms.has(code) });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening at http://localhost:${PORT}`));
