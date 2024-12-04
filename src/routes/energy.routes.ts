//** ELYSIA AND JWT MODULE IMPORT
import Elysia from 'elysia'

//** MEMGRAPH DRIVER AND TYPES
import { Driver } from 'neo4j-driver';
import { getDriver } from '../db/memgraph';

//** SERVICE IMPORT
import EnergyService from '../game.services/energy.services/energy.service';

//** SCHEMA IMPORT
import { useEnergySchema } from '../game.services/energy.services/energy.schema';

const energy = (app: Elysia): void => {


    app.post('/api/energy/use', async ({ headers, body }): Promise<boolean> => {
        try {
            const apiKeyHeader: string | null = headers['x-api-key'];

            const energyService: EnergyService = new EnergyService()
            const result: boolean = await energyService.usePlayerEnergy(body.username, apiKeyHeader);

            return result
        } catch (error: any) {
          throw error
        }
      }, useEnergySchema
    )
}

export default energy