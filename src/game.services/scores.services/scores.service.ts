//** IMPORTED TYPES
import { Driver } from "neo4j-driver";
import { ClassicScoreStats, ScorePeerId } from "../leaderboard.services/leaderboard.interface";

//** MONGODB IMPORT
import { mongoDBClient } from "../../db/mongodb.client";


//** IMPORTED SERVICES
import TokenService from "../../user.services/token.services/token.service";
import RewardService from "../rewards.services/rewards.service";

import { RewardData } from "../rewards.services/reward.interface";
import ExperienceService from "../experience.services/experience.service";
import { LevelUpResult } from "../experience.services/experience.interface";


class ScoreService {

    driver?: Driver;
    constructor(driver?: Driver) {
        this.driver = driver;
    }   

    //** BEATS SERVER EXCLUSIVE SERVICE */
    public async saveScoreClassic(score: ClassicScoreStats, apiKey: string): Promise<LevelUpResult> {
		try {
			const tokenService: TokenService = new TokenService();
			const isAuthorized: boolean = await tokenService.verifyApiKey(apiKey);

			if (!isAuthorized) {
				throw new Error("Unauthorized");
			}

			// Add timestamp to score
			const scoreWithTime = { ...score, timestamp: Date.now() };

			// Establish MongoDB connection
			const client = await mongoDBClient.connect();
			const collection = client.db("beats").collection("classicScores")

			// Insert score into the collection
			await collection.insertOne(scoreWithTime);

			// Calculate experience gain
			const experienceGain: LevelUpResult = await this.calculateExperience(score.username, score.accuracy);

			return experienceGain;

			// const rewardService: RewardService = new RewardService();

			// // Check for song reward
			// const rewardData: RewardData = { songName: score.songName, songRewardType: "first", type: "song" };
			// const isFirstSongComplete: boolean = await rewardService.checkSongReward(score.username, rewardData);

			// if (!isFirstSongComplete) {
			// 	const dataReward = {
			// 		username: score.username,
			// 		type: rewardData.type,
			// 		songName: score.songName,
			// 		songRewardType: rewardData.songRewardType,
			// 		rewardName: `First time completing ${score.songName}`,
			// 	};
			// 	rewardService.setMissionReward(score.username, dataReward);
			// }


		} catch (error: any) {
			console.error("Error saving classic score:", error);
			throw error;
		} finally {
			await mongoDBClient.close();
		}
	}
    

    //* CLASSIC GAME MODE RETRIEVE SCORE FUNCTION
	public async getHighScoreClassic(peerId: ScorePeerId, token: string): Promise<ClassicScoreStats[]> {
		try {
			const tokenService: TokenService = new TokenService();
			await tokenService.verifyAccessToken(token);

			// Establish MongoDB connection
			const client = await mongoDBClient.connect();
			const db = client.db("beats");
			const collection = db.collection<ClassicScoreStats>("classicScores");

			// Convert peerId to number
			const idPeer: number = parseInt(peerId.peerId);

			// Query the collection for scores
			const classicScoreStats: ClassicScoreStats[] = await collection
				.find({ peerId: idPeer })
				.toArray();

			return classicScoreStats;
		} catch (error: any) {
			console.error("Error fetching high scores:", error);
			throw error;
		} finally {
			await mongoDBClient.close();
		}
	}


    private async calculateExperience(username: string, accuracy: number): Promise<LevelUpResult> {
        try {
            const experienceService: ExperienceService = new ExperienceService(this.driver);
            const result: LevelUpResult = await experienceService.calculateExperienceGain(username, accuracy);

            return result
        } catch(error: any) {
          console.log(error)
          throw error
        }
    }
    
    
}

export default ScoreService;


// const toPascalCase = (str: string): string => {
//     return str
//         .toLowerCase()
//         .split(' ')
//         .map(word => word.charAt(0).toUpperCase() + word.slice(1))
//         .join('');
// }