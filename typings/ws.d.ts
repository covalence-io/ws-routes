import { WebSocket, RawData } from "ws";

declare module 'ws' {
    interface WebSocket {
        isAlive: boolean;
    }

    interface IWebSocketClients {
        threads: {
            [x: string]: WebSocket[];
        };
    }

    type IExtRawData = RawData & number[];
}