const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.get('/health', (_req, res) => res.json({ ok: true, game: 'Sehir Hayati 3D', online: io.engine.clientsCount }));
app.get('*', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

const players = new Map();
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const validNumber = n => typeof n === 'number' && Number.isFinite(n);

io.on('connection', socket => {
  socket.emit('players:sync', Array.from(players.values()));

  socket.on('player:join', raw => {
    const data = raw && typeof raw === 'object' ? raw : {};
    const player = {
      id: socket.id,
      name: String(data.name || 'Oyuncu').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 18) || 'Oyuncu',
      x: validNumber(data.x) ? clamp(data.x, -95, 95) : 0,
      z: validNumber(data.z) ? clamp(data.z, -95, 95) : 20,
      heading: validNumber(data.heading) ? data.heading : 0,
    };
    players.set(socket.id, player);
    socket.broadcast.emit('player:joined', player);
    io.emit('online:count', players.size);
  });

  socket.on('player:update', raw => {
    const current = players.get(socket.id);
    if (!current || !raw || typeof raw !== 'object') return;
    if (validNumber(raw.x)) current.x = clamp(raw.x, -95, 95);
    if (validNumber(raw.z)) current.z = clamp(raw.z, -95, 95);
    if (validNumber(raw.heading)) current.heading = clamp(raw.heading, -Math.PI * 100, Math.PI * 100);
    if (typeof raw.name === 'string') current.name = raw.name.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 18) || current.name;
    socket.broadcast.volatile.emit('player:moved', current);
  });

  socket.on('disconnect', () => {
    if (players.delete(socket.id)) {
      socket.broadcast.emit('player:left', { id: socket.id });
      io.emit('online:count', players.size);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Şehir Hayatı 3D multiplayer sunucusu ${PORT} portunda hazır.`));
