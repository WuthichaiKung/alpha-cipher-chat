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
    if (!roomCode) {
      try {
        const msg = JSON.parse(data.toString());
        roomCode = msg.room;
        if (!rooms.has(roomCode)) rooms.set(roomCode, new Set());
        rooms.get(roomCode).add(ws);

        // แจ้งให้ทั้ง 2 ฝั่งรู้ว่าเชื่อมต่อแล้ว
        if (rooms.get(roomCode).size >= 2) {
          rooms.get(roomCode).forEach((client) => {
            client.send(JSON.stringify({ type: 'ready' }));
          });
        }
      } catch (e) {
        console.error('Invalid join/create message');
      }
      return;
    }

    // ส่งข้อความไปยังอีกฝ่าย
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
  });

  ws.on('close', () => {
    if (!roomCode) return;
    const peers = rooms.get(roomCode);
    if (!peers) return;
    peers.delete(ws);

    // ✅ แจ้งอีกฝั่งว่า peer ออก
    for (const client of peers) {
      if (client !== ws && client.readyState === client.OPEN) {
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening at http://localhost:${PORT}`));
