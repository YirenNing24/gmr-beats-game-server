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

  app.get('/api/reward/card', async ({ headers }) => {
      try {
        const authorizationHeader: string = headers.authorization;
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
          throw new Error('Bearer token not found in Authorization header');
        }
        const jwtToken: string = authorizationHeader.substring(7);

        const driver: Driver = getDriver();
        const rewardService: RewardService = new RewardService(driver)
        
        const output = await rewardService.getAvailableCardReward(jwtToken);

        return output 
      } catch (error: any) {
        console.log(error)
        throw error

        }
     }, authorizationBearerSchema
    )

    
  .post('/api/reward/claim/ownership', async ({ headers, body }): Promise<SuccessMessage> => {
      try {
        const authorizationHeader: string = headers.authorization;
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
          throw new Error('Bearer token not found in Authorization header');
        }
        const jwtToken: string = authorizationHeader.substring(7);

        const driver: Driver = getDriver();
        const rewardService: RewardService = new RewardService(driver)
        
        const output: SuccessMessage = await rewardService.ClaimCardOwnershipReward(jwtToken, body);

        return output as SuccessMessage
      } catch (error: any) {
        throw error

        }
     }, claimCardOwnershipRewardSchema
    )


  .post('/api/reward/claim/zodiac', async ({ headers, body }): Promise<SuccessMessage> => {
      try {
        const authorizationHeader: string = headers.authorization;
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
          throw new Error('Bearer token not found in Authorization header');
        }
        const jwtToken: string = authorizationHeader.substring(7);

        const driver: Driver = getDriver();
        const rewardService: RewardService = new RewardService(driver)
        
        const output = await rewardService.provideHoroscopeReward(jwtToken, body);

        return output as SuccessMessage;
      } catch (error: any) {
        throw error

        }
     }, claimCardOwnershipRewardSchema
    )

  .post('/api/reward/claim/animal', async ({ headers, body }): Promise<SuccessMessage> => {
      try {
        const authorizationHeader: string = headers.authorization;
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
          throw new Error('Bearer token not found in Authorization header');
        }
        const jwtToken: string = authorizationHeader.substring(7);

        const driver: Driver = getDriver();
        const rewardService: RewardService = new RewardService(driver)
        
        const output: SuccessMessage = await rewardService.provideAnimalReward(jwtToken, body);

        return output as SuccessMessage;
      } catch (error: any) {
        throw error

        }
     }, claimCardOwnershipRewardSchema
    )


  .get('/api/reward/mission/list', async ({ headers }) => {
      try {
        const authorizationHeader: string = headers.authorization;
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
          throw new Error('Bearer token not found in Authorization header');
        }
        const jwtToken: string = authorizationHeader.substring(7);

        const driver: Driver = getDriver();
        const rewardService: RewardService = new RewardService(driver)
        
        const output: RewardData[] = await rewardService.getMissionRewardList(jwtToken);

        return output 
      } catch (error: any) {
        console.log(error)
        throw error

        }
     }, authorizationBearerSchema
    )

  .post('/api/reward/mission/claim', async ({ headers, body }): Promise<SuccessMessage> => {
      try {
        const authorizationHeader: string = headers.authorization;
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
          throw new Error('Bearer token not found in Authorization header');
        }
        const jwtToken: string = authorizationHeader.substring(7);

        const driver: Driver = getDriver();
        const rewardService: RewardService = new RewardService(driver)
        
        const output: SuccessMessage = await rewardService.claimMissionReward(jwtToken, body);

        return output as SuccessMessage;
      } catch (error: any) {
        throw error

        }
     }, claimMissionRewardSchema
    )


}

export default rewards