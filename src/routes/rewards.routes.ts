//** ELYSIA IMPORT
import Elysia from 'elysia';

//** MEMGRAPH IMPORT 
import { getDriver } from '../db/memgraph';
import { Driver } from 'neo4j-driver';

//** SERVICE IMPORT
import RewardService from '../game.services/rewards.services/rewards.service';

//** TYPE INTERFACES
import { RewardData } from '../game.services/rewards.services/reward.interface';

//** SCHEMA IMPORT
import { authorizationBearerSchema } from './route.schema/schema.auth';
import { claimCardOwnershipRewardSchema, claimMissionRewardSchema } from '../game.services/rewards.services/rewards.schema';

//** OUTPUT MESSSAGE IMPORT
import { SuccessMessage } from '../outputs/success.message';



const rewards = (app: Elysia) => {

  app.get('/api/reward/personal-missions', async ({ headers }) => {
      try {
        const authorizationHeader: string = headers.authorization;
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
          throw new Error('Bearer token not found in Authorization header');
        }
        const jwtToken: string = authorizationHeader.substring(7);
        const rewardService: RewardService = new RewardService()
        
        const output = await rewardService.getPersonalMissions(jwtToken);
        return output 
      } catch (error: any) {
        console.log(error)
        throw error

        }
     }, authorizationBearerSchema
    )

    .get('/api/reward/collection-missions', async ({ headers }) => {
      try {
        const authorizationHeader: string = headers.authorization;
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
          throw new Error('Bearer token not found in Authorization header');
        }
        const jwtToken: string = authorizationHeader.substring(7);
        const rewardService: RewardService = new RewardService()
        
        const output = await rewardService.getCollectionMissions(jwtToken);
        return output 
      } catch (error: any) {
        console.log(error)
        throw error

        }
     }, authorizationBearerSchema
    )

    
 


}

export default rewards