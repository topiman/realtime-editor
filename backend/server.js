const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// 上限：单文件 20MB 密文、单房间 100MB 密文；socket 缓冲 25MB 给一条 20MB 的消息留余量
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_ROOM_BYTES = 100 * 1024 * 1024;

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 25 * 1024 * 1024,
});

// 每个房间的状态：
//   rooms[name] = { text: string|null, files: { [id]: {meta, blob, bytes} }, totalBytes: number }
// 所有 text/meta/blob 都是客户端 AES-GCM 加密后的 base64 envelope，服务端无法解密
const rooms = {};

function ensureRoom(name) {
  if (!rooms[name]) rooms[name] = { text: null, files: {}, totalBytes: 0 };
  return rooms[name];
}

function roomTotalBytes(r) {
  let n = r.text ? r.text.length : 0;
  for (const id in r.files) n += r.files[id].bytes;
  return n;
}

// 房间元数据端点：只暴露不含明文的信息（房间名、人数、密文长度、指纹、附件数），
// 服务端本来就看不到明文
app.get('/rooms', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const names = new Set(Object.keys(rooms));
  for (const [name] of io.sockets.adapter.rooms) {
    if (!io.sockets.sockets.has(name)) names.add(name);
  }
  const list = [];
  for (const name of names) {
    const clients = io.sockets.adapter.rooms.get(name)?.size ?? 0;
    const r = rooms[name];
    const text = r?.text || '';
    const fileCount = r ? Object.keys(r.files).length : 0;
    list.push({
      name,
      clients,
      hasContent: !!(r && (r.text || fileCount > 0)),
      totalBytes: r?.totalBytes ?? 0,
      fileCount,
      fingerprint: text ? text.split('.')[0] : null,
    });
  }
  list.sort((a, b) => b.clients - a.clients || a.name.localeCompare(b.name));
  res.json({ rooms: list, total: list.length });
});

io.on('connection', (socket) => {
  let currentRoom = null;

  // 加入房间
  socket.on('join', (room) => {
    if (!room || room.trim() === '') room = 'default';
    currentRoom = room.trim();
    socket.join(currentRoom);

    const r = rooms[currentRoom];
    socket.emit('init', {
      text: r?.text || null,
      files: r?.files ? Object.fromEntries(
        Object.entries(r.files).map(([id, f]) => [id, { meta: f.meta, blob: f.blob }])
      ) : {},
    });
    console.log(`Client ${socket.id} joined room: ${currentRoom}`);
  });

  // 文本同步
  socket.on('edit', (content) => {
    if (!currentRoom || typeof content !== 'string') return;
    const r = ensureRoom(currentRoom);
    r.text = content;
    r.totalBytes = roomTotalBytes(r);
    socket.to(currentRoom).emit('update', content);
  });

  // 新附件
  socket.on('addFile', (payload) => {
    if (!currentRoom) return;
    if (!payload || typeof payload.id !== 'string' ||
        typeof payload.meta !== 'string' || typeof payload.blob !== 'string') {
      socket.emit('fileError', { id: payload?.id, reason: 'invalid_payload' });
      return;
    }
    const { id, meta, blob } = payload;
    const bytes = meta.length + blob.length;
    if (bytes > MAX_FILE_BYTES) {
      socket.emit('fileError', { id, reason: 'file_too_large' });
      return;
    }
    const r = ensureRoom(currentRoom);
    const projected = r.totalBytes + bytes - (r.files[id]?.bytes || 0);
    if (projected > MAX_ROOM_BYTES) {
      socket.emit('fileError', { id, reason: 'room_quota_exceeded' });
      return;
    }
    r.files[id] = { meta, blob, bytes };
    r.totalBytes = roomTotalBytes(r);
    io.to(currentRoom).emit('fileAdded', { id, meta, blob });
  });

  // 删除附件
  socket.on('removeFile', (payload) => {
    if (!currentRoom) return;
    const id = payload && payload.id;
    if (typeof id !== 'string') return;
    const r = rooms[currentRoom];
    if (!r || !r.files[id]) return;
    delete r.files[id];
    r.totalBytes = roomTotalBytes(r);
    io.to(currentRoom).emit('fileRemoved', { id });
  });

  // 如果最后一个客户端离开，销毁房间（用 disconnecting 是因为此时
  // socket 还在 rooms 里，能准确判断"我是不是最后一个"）
  socket.on('disconnecting', () => {
    if (!currentRoom) return;
    const remaining = (io.sockets.adapter.rooms.get(currentRoom)?.size ?? 0) - 1;
    if (remaining <= 0 && rooms[currentRoom] !== undefined) {
      delete rooms[currentRoom];
      console.log(`Room ${currentRoom} destroyed (last client left)`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client ${socket.id} disconnected`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
