//** IMPORTED TYPES
import { Driver } from "neo4j-driver";
import { ClassicScoreStats, ScorePeerId } from "../leaderboard.services/leaderboard.interface";

//** MONGODB IMPORT
import { mongoDBClient } from "../../db/mongodb.client";
import { MongoClient } from "mongodb";

//** IMPORTED SERVICES
import TokenService from "../../user.services/token.services/token.service";
import ExperienceService from "../experience.services/experience.service";
import SongRewardService from "../rewards.services/song.rewards.service";

//** INTERFACE IMPORT
import { LevelUpResult } from "../experience.services/experience.interface";



class ScoreService {

    driver?: Driver;
    constructor(driver?: Driver) {
        this.driver = driver;
    }   

    //** BEATS SERVER EXCLUSIVE SERVICE */
    public async saveScoreClassic(score: ClassicScoreStats, apiKey: string): Promise<LevelUpResult> {
		const tokenService: TokenService = new TokenService();
		const songRewardService: SongRewardService = new SongRewardService();
		try {
			const isAuthorized: boolean = await tokenService.verifyApiKey(apiKey);

			if (!isAuthorized) {
				throw new Error("Unauthorized");
			}

			// Add timestamp to score
			const scoreWithTime = { ...score, timestamp: Date.now() };

			// Establish MongoDB connection
			const client: MongoClient = await mongoDBClient.connect();
			const collection = client.db("beats").collection("classicScores");

			// Insert score into the collection
			await collection.insertOne(scoreWithTime);

			// Calculate experience gain
			const experienceGain: LevelUpResult = await this.calculateExperience(score.username, score.accuracy);
			const beatsReward: number  = await songRewardService.classicSongReward(apiKey, score);

			experienceGain.beatsReward = beatsReward
			return experienceGain;	
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
			const client: MongoClient = await mongoDBClient.connect();
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

	//* CLASSIC GAME MODE RETRIEVE ALL SCORE FUNCTION
	public async getPlayerHighScorePerSong(token: string): Promise<ClassicScoreStats[]> {
		try {
			const tokenService: TokenService = new TokenService();
			const username: string = await tokenService.verifyAccessToken(token);
	
			// Establish MongoDB connection
			const client: MongoClient = await mongoDBClient.connect();
			const db = client.db("beats");
			const collection = db.collection<ClassicScoreStats>("classicScores");
	
			// Aggregate query to get highest score per song for the user
			const highScores = await collection
				.aggregate([
					{ $match: { username } }, // Filter by username
					{
						$group: {
							_id: "$songName", // Group by songName
							songName: { $first: "$songName" }, // Keep songName explicitly
							difficulty: { $first: "$difficulty" },
							score: { $max: "$score" }, // Get max score per song
							combo: { $first: "$combo" },
							maxCombo: { $first: "$maxCombo" },
							accuracy: { $first: "$accuracy" },
							finished: { $first: "$finished" },
							artist: { $first: "$artist" },
							perfect: { $first: "$perfect" },
							veryGood: { $first: "$veryGood" },
							good: { $first: "$good" },
							bad: { $first: "$bad" },
							miss: { $first: "$miss" },
							username: { $first: "$username" },
							peerId: { $first: "$peerId" }
						}
					},
					{ $sort: { score: -1 } } // Sort by highest score first
				])
				.toArray();
	
			// Remove `_id` and ensure `songName` is present
			const formattedScores = highScores.map(({ _id, ...rest }) => rest) as unknown as ClassicScoreStats[];
	
			// Close the database connection
			await client.close();
	
			return formattedScores;
		} catch (error: any) {
			console.error("Error fetching high scores:", error);
			throw error;
		}
	}
	

	//* CLASSIC GAME MODE RETRIEVE ALL SCORE FUNCTION
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