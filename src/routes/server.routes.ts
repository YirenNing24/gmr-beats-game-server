//** ELYSIA IMPORT
import Elysia from "elysia";

//** SERVER SERVICE IMPORT
import ServerService from "../user.services/auth.services.ts/server.service";


const server = (app: Elysia): void => {
    app.ws('/api/ping', {
        message(ws, { message }) {
            try {
                const serverService: ServerService = new ServerService(ws);
                serverService.checkLatency(message);
            } catch (error: any) {
                console.error('Error in WebSocket message event:', error);
                throw error;
        }
    }
    })
}

export default server;
