import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const setupFamilyChat = (io) => {
  io.on('connection', (socket) => {
    socket.on('join_family', async (familyId) => {
      const id = Number.parseInt(familyId, 10);
      if (!Number.isInteger(id)) return;
      const member = await prisma.familyMember.findUnique({ where: { userId_familyId: { userId: socket.data.user.id, familyId: id } } });
      if (member) socket.join(`family_${id}`);
    });

    socket.on('send_family_message', async (data) => {
      try {
        const familyId = Number.parseInt(data.familyId, 10);
        const content = String(data.content || '').trim().slice(0, 2000);
        if (!Number.isInteger(familyId) || !content) return;
        const member = await prisma.familyMember.findUnique({ where: { userId_familyId: { userId: socket.data.user.id, familyId } } });
        if (!member) return;
        const saved = await prisma.familyMessage.create({
          data: { content, userId: socket.data.user.id, familyId },
          include: { user: { select: { id: true, name: true, avatar: true } } }
        });
        io.to(`family_${saved.familyId}`).emit('receive_family_message', saved);
      } catch (err) {
        console.error('Chat save error:', err);
      }
    });

    socket.on('new_meal_request', async (data) => {
      const familyId = Number.parseInt(data?.familyId, 10);
      const mealName = String(data?.mealName || '').trim().slice(0, 120);
      if (!Number.isInteger(familyId) || !mealName) return;
      const member = await prisma.familyMember.findUnique({ where: { userId_familyId: { userId: socket.data.user.id, familyId } } });
      if (!member) return;
      io.to(`family_${familyId}`).emit('receive_family_message', {
        message: `New meal request: ${mealName}`,
        user: { name: socket.data.user.name || 'Member', id: socket.data.user.id },
        timestamp: new Date()
      });
    });

    socket.on('vote_cast', async (data) => {
      const requestId = Number.parseInt(data?.requestId, 10);
      try {
        if (!Number.isInteger(requestId)) return;
        const request = await prisma.mealRequest.findUnique({ where: { id: requestId }, select: { familyId: true } });
        if (!request) return;
        const member = await prisma.familyMember.findUnique({ where: { userId_familyId: { userId: socket.data.user.id, familyId: request.familyId } } });
        const userVote = await prisma.vote.findUnique({ where: { userId_requestId: { userId: socket.data.user.id, requestId } } });
        if (!member || !userVote) return;
        const votes = await prisma.vote.findMany({ where: { requestId } });
        const counts = votes.reduce((acc, vote) => {
          acc[vote.selectedOption] = (acc[vote.selectedOption] || 0) + 1;
          return acc;
        }, {});
        io.to(`family_${request.familyId}`).emit('vote_updated', { requestId, counts });
      } catch (e) {
        console.error(e);
      }
    });
  });
};
