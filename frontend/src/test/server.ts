import { setupServer } from 'msw/node';

/** Servidor MSW compartilhado. Cada teste registra seus handlers com server.use(...). */
export const server = setupServer();
export const API = 'http://localhost:5285';
