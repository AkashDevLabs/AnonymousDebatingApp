const express = require('express');
const cors = require('cors');
const corsOptions ={
  origin:'https://debate-app-frontend-ax42i0ycp-adwin54s-projects.vercel.app/', 
  credentials:true,            //access-control-allow-credentials:true
  optionSuccessStatus:200
}
const http = require('http');
const { Server } = require('socket.io');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

//cors config
app.use(cors({
  origin: 'https://debate-app-frontend-ax42i0ycp-adwin54s-projects.vercel.app/', // Replace with your Vercel frontend URL
  methods: ['GET', 'POST'],
  credentials: true,
}));

// Enable CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: 'https://debate-app-frontend-ax42i0ycp-adwin54s-projects.vercel.app', // Replace with your frontend URL
    methods: ['GET', 'POST'],
    credentials: true, // Allow credentials (if needed)
  },
});

// Store active debates and users
const debates = new Map();

// Socket.io connection
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Join a debate room
  socket.on('joinDebate', (roomId, role) => {
    socket.join(roomId);
    debates.set(roomId, { users: [...(debates.get(roomId)?.users || []), { id: socket.id, role }] });
    io.to(roomId).emit('updateDebate', Array.from(debates.get(roomId).users));
  });

  // Send a message in the debate
  socket.on('sendMessage', async ({ roomId, message }) => {
    const debate = debates.get(roomId);
    if (!debate) return;

    // AI moderation
    const moderation = await openai.moderations.create({ input: message });
    if (moderation.results[0].flagged) {
      socket.emit('moderationWarning', 'Your message was flagged as inappropriate.');
      return;
    }

    // Broadcast the message
    io.to(roomId).emit('receiveMessage', { user: socket.id, message });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
