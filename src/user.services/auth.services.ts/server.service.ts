//** ELYSIA IMPORTS
import { ElysiaWS } from "elysia/ws";



class ServerService {
	websocket?: ElysiaWS<any>;

	constructor(websocket?: ElysiaWS<any>) {
		this.websocket = websocket;
	}

    public async checkLatency(message: { timestamp: number }) {
        try {
            const ws = this.websocket;
            const { timestamp } = message
            const serverTimePing = [{ "type": "pong", "timestamp": timestamp }];

            const stringifyServerTime: string = JSON.stringify(serverTimePing);
            ws?.send(stringifyServerTime);

        } catch(error: any) {
          console.log(error);
          throw error
        }

    }
 
}

export default ServerService