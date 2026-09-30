import { createServer } from 'node:net';

export const API_PORT = 34435;
export const FRONTEND_PORT = 35185;

export async function availablePort(first, { signal } = {}) {
  for (let port = first; port <= 65535; port++) {
    signal?.throwIfAborted();
    const free = await new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once('error', error => ['EADDRINUSE', 'EACCES'].includes(error.code) ? resolve(false) : reject(error));
      probe.listen({ port, host: '127.0.0.1', exclusive: true }, () => probe.close(() => resolve(true)));
    });
    if (free) return port;
  }
  throw new Error('Não há uma porta livre para iniciar o jogo.');
}
