// Entry point for cPanel's Node.js app (Passenger). CommonJS so Passenger can load it; Node 22.18+ runs the TypeScript server natively.
process.env.SHEETSMITH_START = '1';
import('./src/server.ts').catch(error => { console.error(error); process.exit(1); });
