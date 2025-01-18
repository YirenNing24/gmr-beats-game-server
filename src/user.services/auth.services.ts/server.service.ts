//** ELYSIA IMPORTS
import { ElysiaWS } from "elysia/ws";
import { cp } from "fs";



class ServerService {
	websocket?: ElysiaWS<any>;

	constructor(websocket?: ElysiaWS<any>) {
		this.websocket = websocket;
	}

    public async checkLatency(message: { type: string, timestamp: number }): Promise<void> {
        try {
            const ws = this.websocket;
    
            const clientTimestamp = message.timestamp; // From client (should be in ms)
            const serverTimestamp = Date.now(); // Server time in ms
    
            // Prepare response with server's current time
            const serverTimePing = [{ 
                "type": "pong", 
                "timestamp": clientTimestamp,  // Echo back the client's timestamp
                "server_time": serverTimestamp // Include server's timestamp for debugging
            }];
    
            const stringifyServerTime: string = JSON.stringify(serverTimePing);
            ws?.send(stringifyServerTime);
    
        } catch (error: any) {
            console.log(error);
            throw error;
        }
    }
    
 
}

export default ServerService