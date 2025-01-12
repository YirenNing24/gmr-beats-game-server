import TokenService from "../../user.services/token.services/token.service";
import { ClassicScoreStats } from "../leaderboard.services/leaderboard.interface";


class SongRewardService {

    public async classicSongReward(apiKey: string, score: ClassicScoreStats): Promise<number> {
		const tokenService: TokenService = new TokenService();

		try {
			// Verify the API key
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

			// Round the reward to 2 decimal places for precision
			return Math.round(reward);
		} catch (error: any) {
			console.error("Error calculating song reward:", error);
			throw error;
		}
	}

            




    }


export default SongRewardService