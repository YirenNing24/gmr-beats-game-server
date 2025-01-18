//** ELYSIA IMPORTS
import { ElysiaWS } from "elysia/ws";
import { cp } from "fs";



class ServerService {
	websocket?: ElysiaWS<any>;

	constructor(websocket?: ElysiaWS<any>) {
		this.websocket = websocket;
	}

    public async checkLatency(message: string) {
        try {
            const ws = this.websocket;
            const pingMessage: { type: string, timestamp: number} = JSON.parse(message);


            console.log('pingMessage', pingMessage);
            const { timestamp } = pingMessage
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