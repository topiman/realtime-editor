const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 每个房间独立存储内容
// 存的是客户端 AES-GCM 加密后的 base64 密文字符串，服务端无法解密
const rooms = {};

io.on('connection', (socket) => {
  let currentRoom = null;

  // 加入房间
  socket.on('join', (room) => {
    if (!room || room.trim() === '') room = 'default';
    currentRoom = room.trim();
    socket.join(currentRoom);

    // 发送当前房间内容
    socket.emit('init', rooms[currentRoom] || '');
    console.log(`Client ${socket.id} joined room: ${currentRoom}`);
  });

  // 收到编辑事件
  socket.on('edit', (content) => {
    if (!currentRoom) return;
    rooms[currentRoom] = content;
    socket.to(currentRoom).emit('update', content);
  });

  // 如果最后一个客户端离开，销毁房间密文（用 disconnecting 是因为此时
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
