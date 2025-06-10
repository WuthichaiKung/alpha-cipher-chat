function generateRoomCode(length = 128) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:\\",.<>/?';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function joinRoom() {
  const room = document.getElementById('roomCodeInput').value.trim();
  if (!room) return alert('Please enter a room code.');
  window.location.href = `chat.html?mode=join&room=${encodeURIComponent(room)}`;
}

function createRoom() {
  const room = generateRoomCode();
  window.location.href = `chat.html?mode=create&room=${encodeURIComponent(room)}`;
}

// ==== Chat Page Logic ====
if (location.pathname.endsWith('chat.html')) {
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode');
  const room = params.get('room');
  document.getElementById('codeDisplay').value = room;

  let ws, aesKey;
  let username = mode === 'create' ? 'Alpha' : 'Delta'; // ✅ ตั้งชื่อฝั่งตัวเอง

  async function deriveKey(pass) {
    const enc = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', enc.encode(pass));
    return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }

  async function encrypt(text) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(text));
    return { iv, ct: new Uint8Array(ct) };
  }

  async function decrypt(iv, ct) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
    return new TextDecoder().decode(pt);
  }

  async function init() {
    aesKey = await deriveKey(room);
    ws = new WebSocket(`ws://${location.host}`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: mode, room }));
    };

    ws.onmessage = async (ev) => {
      if (typeof ev.data === 'string') {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'ready') {
          addMessage('System', 'Peer connected');
        } else if (msg.type === 'message') {
          const iv = Uint8Array.from(atob(msg.iv), c => c.charCodeAt(0));
          const ct = Uint8Array.from(atob(msg.ct), c => c.charCodeAt(0));
          const text = await decrypt(iv, ct);

          // ✅ ฝั่งตรงข้ามแสดงชื่อที่ตรงข้ามกับเรา
          const peerName = username === 'Alpha' ? 'Delta' : 'Alpha';
          addMessage(peerName, text);
        } else if (msg.type === 'peer-disconnected') {
          addMessage('System', 'Peer disconnected.');
        }
      }
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
    };
  }

  function addMessage(sender, text) {
    const win = document.getElementById('chatWindow');
    const div = document.createElement('div');
    div.className = 'message';
    div.textContent = `${sender}: ${text}`;
    win.append(div);
    win.scrollTop = win.scrollHeight;
  }

  async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) return;
    const { iv, ct } = await encrypt(text);
    ws.send(JSON.stringify({
      type: 'message',
      iv: btoa(String.fromCharCode(...iv)),
      ct: btoa(String.fromCharCode(...ct))
    }));
    addMessage(username, text); // ✅ แสดงชื่อฝั่งตัวเอง
    input.value = '';
  }

  function copyCode() {
    navigator.clipboard.writeText(room).then(() => alert('Copied!'));
  }

  function disconnect() {
    ws.close();
    window.location.href = 'index.html';
  }

  document.getElementById('messageInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendMessage();
  });

  document.querySelector('button[onclick="sendMessage()"]').onclick = sendMessage;
  document.querySelector('button[onclick="copyCode()"]').onclick = copyCode;
  document.querySelector('button[onclick="disconnect()"]').onclick = disconnect;

  init();
}
