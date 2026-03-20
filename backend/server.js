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

// 内存存储当前内容
let currentContent = '';

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // 新连接时发送当前内容
  socket.emit('init', currentContent);

  // 收到编辑事件，更新并广播给其他人
  socket.on('edit', (content) => {
    currentContent = content;
    socket.broadcast.emit('update', content);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
