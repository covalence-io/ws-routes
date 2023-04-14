import cookieParser from 'cookie-parser';
import { Server } from 'http';
import { Request, Response } from 'express';
import { WebSocketServer, WebSocket, IWebSocketClients, IExtRawData } from 'ws';
import { AT_KEY, COOKIE_SECRET, validToken } from '../utils';

const HEARTBEAT_INTERVAL = 1000 * 5; // 5 seconds
const HEARTBEAT_VALUE = 1;
const clients = {
    threads: {},
    // scoring: {},
} as IWebSocketClients;

function onSocketPreError(e: Error) {
    console.log(e);
}

function onSocketPostError(e: Error) {
    console.log(e);
}

function ping(ws: WebSocket) {
    ws.send(HEARTBEAT_VALUE, { binary: true });
}

function sendAll(ws: WebSocket, wss: WebSocketServer) {
    ws.on('message', (msg: IExtRawData, isBinary) => {
        if (isBinary && msg.length === 1 && msg[0] === HEARTBEAT_VALUE) {
            // console.log('pong');
            ws.isAlive = true;
        } else {
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(msg, { binary: isBinary });
                }
            });
        }
    });

    ws.on('close', () => {
        console.log('Connection closed');
    });
}

function sendThread(ws: WebSocket, threadid: string) {
    if (!threadid) {
        ws.on('close', () => {
            console.log('Connection closed');
        });
        return;
    }

    const threads = clients.threads;

    if (!threads[threadid]) {
        threads[threadid] = [ws];
    } else {
        threads[threadid].push(ws);
    }

    ws.on('message', (msg: IExtRawData, isBinary) => {
        if (isBinary && msg.length === 1 && msg[0] === HEARTBEAT_VALUE) {
            // console.log('pong');
            ws.isAlive = true;
        } else {
            threads[threadid].forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(msg, { binary: isBinary });
                }
            });
        }
    });

    ws.on('close', () => {
        console.log('Connection closed');

        const idx = threads[threadid].indexOf(ws);

        if (idx >= 0) {
            threads[threadid].splice(idx, 1);

            if (threads[threadid].length === 0) {
                delete threads[threadid];
            }
        }
    });
}

export default function configure(s: Server) {
    const wss = new WebSocketServer({ noServer: true });

    s.on('upgrade', (req, socket, head) => {
        socket.on('error', onSocketPreError);

        // perform auth
        cookieParser(COOKIE_SECRET)(req as Request, {} as Response, () => {
            const signedCookies = (req as Request).signedCookies;
            let at = signedCookies[AT_KEY];

            if (!at && !!req.url) {
                const url = new URL(req.url, `ws://${req.headers.host}`);
                at = url.searchParams.get('at');
            }

            if (!validToken(at)) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            wss.handleUpgrade(req, socket, head, (ws) => {
                socket.removeListener('error', onSocketPreError);
                wss.emit('connection', ws, req);
            });
        });
    });

    wss.on('connection', (ws, req) => {
        ws.isAlive = true;

        ws.on('error', onSocketPostError);

        if (!req.url) {
            sendAll(ws, wss);
        } else {
            const idx = req.url.indexOf('?');
            const uri = idx >= 0 ? req.url.slice(0, idx) : req.url;
            const paths = uri.split('/').filter((p) => !!p);

            switch (paths[0]) {
                case 'thread':
                    sendThread(ws, paths[1]);
                    break;
                default:
                    sendAll(ws, wss);
                    break;
            }
        }
    });

    const interval = setInterval(() => {
        // console.log('firing interval');
        wss.clients.forEach((client) => {
            if (!client.isAlive) {
                client.terminate();
                return;
            }

            client.isAlive = false;
            ping(client);
        });
    }, HEARTBEAT_INTERVAL);

    wss.on('close', () => {
        clearInterval(interval);
    });
}