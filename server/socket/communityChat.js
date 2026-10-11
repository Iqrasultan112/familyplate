export const setupCommunityChat = (io) => {
  io.on('connection', (socket) => {
    socket.on('join_community', () => {
      socket.join('community');
    });

    socket.on('join_user_room', (userId) => {
      if (Number(userId) === Number(socket.data.user.id)) socket.join(`user_${socket.data.user.id}`);
    });

    socket.on('send_community_message', (data) => {
      const message = String(data?.message || '').trim().slice(0, 2000);
      if (!message) return;
      const user = { id: socket.data.user.id, name: socket.data.user.name || 'Member' };
      io.to('community').emit('receive_community_message', {
        message,
        user,
        userId: socket.data.user.id,
        timestamp: new Date(),
        isVoice: Boolean(data?.isVoice)
      });
      if (data?.isVoice) io.to(`user_${socket.data.user.id}`).emit('ai_suggestion', { text: message });
    });

    socket.on('send_voice_message', (data) => {
      const message = String(data?.message || '').trim().slice(0, 2000);
      if (!message) return;
      const user = { id: socket.data.user.id, name: socket.data.user.name || 'Member' };
      io.to('community').emit('receive_community_message', {
        message,
        user,
        userId: socket.data.user.id,
        timestamp: new Date(),
        isVoice: true
      });
      
      // Simulate AI detection
      setTimeout(() => {
        io.to(`user_${socket.data.user.id}`).emit('ai_suggestion', {
          text: message
        });
      }, 1000);
    });

  });
};
