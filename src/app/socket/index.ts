import { Server as HttpServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server, Socket } from 'socket.io';
import { pubClient, subClient } from '@app/redis/index.js';
import { socketAuthMiddleware } from './middleware/auth.socket.js';

const setUserSocket = (userId: string, socketId: string) =>
  Promise.all([
    pubClient.hSet('userId_to_socketId', userId, socketId),
    pubClient.hSet('socketId_to_userId', socketId, userId),
  ]);

const removeUserSocket = (userId: string, socketId: string) =>
  Promise.all([
    pubClient.hDel('userId_to_socketId', userId),
    pubClient.hDel('socketId_to_userId', socketId),
  ]);

const initializeSocket = async (server: HttpServer) => {
  const io = new Server(server, {
    cors: { origin: '*' },
  });

  io.adapter(createAdapter(pubClient, subClient));
  io.use(socketAuthMiddleware);
  global.socketio = io;

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data?.userId as string;

    if (!userId) {
      console.warn(
        `Socket ${socket.id} connected without userId — disconnecting`,
      );
      socket.disconnect();
      return;
    }

    console.log(`✅ Connected: userId=${userId} socketId=${socket.id}`);
    await setUserSocket(userId, socket.id);
    socket.join(userId);

    socket.on('disconnect', async () => {
      const uid = await pubClient.hGet('socketId_to_userId', socket.id);
      if (uid) {
        await removeUserSocket(uid, socket.id);
        console.log(`❌ Disconnected: userId=${uid} socketId=${socket.id}`);
      }
    });
  });

  return io;
};

export default initializeSocket;
