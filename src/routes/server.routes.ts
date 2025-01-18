//** ELYSIA IMPORT
import Elysia, { t } from "elysia";

//** SERVER SERVICE IMPORT
import ServerService from "../user.services/auth.services.ts/server.service";
import { authorizationBearerSchema } from "./route.schema/schema.auth";


const server = (app: Elysia): void => {
    app.ws('/api/ping', {
        // Validate the incoming WebSocket message
        body: t.Object({ type: t.String(), timestamp: t.Number() }),
        async message(ws, message) {
            try {

                // Initialize the ServerService with the WebSocket instance
                const serverService: ServerService = new ServerService(ws);

                // Process the latency check
                serverService.checkLatency(message);
            } catch (error: any) {
                console.error('Error in WebSocket message event:', error);
                throw error;
            }
        }
    });
}

export default server;
