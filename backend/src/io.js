// backend/src/io.js
// Shared Socket.IO instance + client sockets set
let _io = null;
const _clientSockets = new Set();

export const setIo = (io) => { _io = io; };
export const getIo = () => _io;

export const addClientSocket = (socket) => _clientSockets.add(socket);
export const removeClientSocket = (socket) => _clientSockets.delete(socket);

// Broadcast plain JSON to all authenticated client sockets (not admins)
export const broadcastToClients = (data) => {
  const msg = JSON.stringify(data);
  _clientSockets.forEach(socket => {
    try {
      if (socket.readyState === 1) socket.send(msg); // 1 = OPEN
    } catch {}
  });
};
