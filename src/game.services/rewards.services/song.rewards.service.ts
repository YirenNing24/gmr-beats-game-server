import { BEATS_TOKEN, CHAIN } from "../../config/constants";
import { getDriver } from "../../db/memgraph";
import TokenService from "../../user.services/token.services/token.service";
import WalletService, { engine } from "../../user.services/wallet.services/wallet.service";
import { ClassicScoreStats } from "../leaderboard.services/leaderboard.interface";
import RewardService from "./mission.rewards.service";


class SongRewardService {


	
    public async classicSongReward(apiKey: string, score: ClassicScoreStats): Promise<number> {
		const tokenService: TokenService = new TokenService();
		try {
			const isAuthorized: boolean = await tokenService.verifyApiKey(apiKey);
			if (!isAuthorized) {
				throw new Error("Unauthorized");
			}

			// Calculate reward based on accuracy and difficulty
			const baseReward = 50; // Base BEATS token reward
			let multiplier = 1; // Default multiplier for difficulty

			switch (score.difficulty.toLowerCase()) {
				case "easy":
					multiplier = 1;
					break;
				case "medium":
					multiplier = 1.5;
					break;
				case "hard":
					multiplier = 2;
					break;
				case "ultra hard":
					multiplier = 3;
					break;
				default:
					multiplier = 1; // Default multiplier if difficulty is unknown
			}

			// Calculate total reward based on accuracy
			const reward = baseReward * score.accuracy * multiplier;
			var beatsRewardAmount: number = Math.round(reward)
			await this.sendBeatsReward(score.username, beatsRewardAmount)

			return beatsRewardAmount;
		} catch (error: any) {
		  console.error("Error calculating song reward:", error);
		  throw error;
		}
	}


	public async sendBeatsReward(username: string, beatsAmount: number) {
		const driver = getDriver();
		const walletService: WalletService = new WalletService(driver);
		const rewardService: RewardService = new RewardService(driver);
		try {

			const smartWalletAddress: string = await walletService.getSmartWalletAddress(username);
			await rewardService.sendBeatsReward(smartWalletAddress, beatsAmount.toString());

		} catch(error: any) {
		  console.log(error)
		  throw error
		 
		}
	}




            




    }


export default SongRewardService