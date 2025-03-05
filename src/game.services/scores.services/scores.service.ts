//** IMPORTED TYPES
import { Driver } from "neo4j-driver";
import { ClassicScoreStats, ScorePeerId } from "../leaderboard.services/leaderboard.interface";

//** MONGODB IMPORT
import { mongoDBClient } from "../../db/mongodb.client";
import { Db, MongoClient } from "mongodb";

//** IMPORTED SERVICES
import TokenService from "../../user.services/token.services/token.service";
import ExperienceService from "../experience.services/experience.service";
import SongRewardService from "../rewards.services/song.rewards.service";

//** INTERFACE IMPORT
import { LevelUpResult } from "../experience.services/experience.interface";
import EnergyService from "../energy.services/energy.service";
import keydb from "../../db/keydb.client";



class ScoreService {

    driver?: Driver;
    constructor(driver?: Driver) {
        this.driver = driver;
    }   

    //** BEATS SERVER EXCLUSIVE SERVICE */
	public async saveScoreClassic(score: ClassicScoreStats, token: string): Promise<LevelUpResult> {
		const tokenService = new TokenService();
		const songRewardService = new SongRewardService();
		let client: MongoClient | null = null;
	
		try {
			const username: string = await tokenService.verifyAccessToken(token);
	
			// Validate gameId in KeyDB
			const keydbData = await keydb.HGETALL(`energy_usage:${score.gameId}`);
	
			// If no data found or username doesn't match, reject the request
			if (!keydbData || keydbData.username !== username) {
				throw new Error("Invalid or expired game session.");
			}
	
			// Establish MongoDB connection
			client = await mongoDBClient.connect();
			const db = client.db("beats");
			const collection = db.collection("classicScores");
	
			// Run experience calculation, beats reward, and high score retrieval in parallel
			const [experienceGain, beatsReward, previousHighscore] = await Promise.all([
				this.calculateExperience(username, score.accuracy),
				songRewardService.classicSongReward(score),
				this.getHighScoreIndividual(score.songName, username, db) // Pass `db` to avoid extra connection
			]);
	
			// Add rewards and highscore info to the score object
			const scoreWithRewards = {
				...score,
				timestamp: Date.now(),
				experienceGain: experienceGain.experienceGained, // Store only experienceGained, not full object
				beatsReward,
				previousHighscore
			};
	
			// Insert the updated score into MongoDB
			await collection.insertOne(scoreWithRewards);
	
			// Add rewards to the experience result
			experienceGain.beatsReward = beatsReward;
			experienceGain.previousHighscore = previousHighscore;
			experienceGain.score = score
	
			// Remove game session from KeyDB after successful validation
			await keydb.DEL(`energy_usage:${score.gameId}`);
	
			return experienceGain;
		} catch (error: any) {
			console.error("Error saving classic score:", error);
			throw error;
		} finally {
			// Ensure MongoDB connection is closed
			if (client) await client.close();
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


	private async getHighScoreIndividual(songName: string, username: string, db: Db): Promise<number> {
		try {
			// Establish MongoDB connection
			const collection = db.collection<ClassicScoreStats>("classicScores");
			// Find the highest score for the given song and username
			const highestScore = await collection
				.find({ songName, username }) // Filter by song name AND username
				.sort({ score: -1 }) // Sort in descending order to get the highest score first
				.limit(1) // Only retrieve one document
				.project({ score: 1, _id: 0 }) // Only return the score field
				.next(); // Get the first result
	
			// Ensure the function always returns a number (never null)
			return highestScore?.score ?? 0;
		} catch (error: any) {
			console.error("Error fetching highest score:", error);
			throw error;
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
					{ $sort: { score: -1, timestamp: -1 } }, // Sort by highest score first, then latest timestamp
					{
						$group: {
							_id: "$songName", // Group by songName
							songName: { $first: "$songName" }, // Take from highest score document
							difficulty: { $first: "$difficulty" },
							score: { $first: "$score" }, // Ensure we take the highest score
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
							username: { $first: "$username" }
						}
					},
					{ $sort: { score: -1 } } // Final sort to return highest scores first
				])
				.toArray();
	
			// Remove `_id` and ensure `songName` is present
			const formattedScores = highScores.map(({ _id, ...rest }) => rest) as ClassicScoreStats[];
	
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


// {
// 	"_id": {
// 	  "$oid": "67c7deb9de3f466a2180e533"
// 	},
// 	"accuracy": 0.91260162601626,
// 	"artist": "X:IN",
// 	"bad": 3,
// 	"combo": 79,
// 	"difficulty": "easy",
// 	"finished": true,
// 	"good": 0,
// 	"maxCombo": 79,
// 	"miss": 0,
// 	"perfect": 65,
// 	"score": 2372100,
// 	"songName": "",
// 	"username": "nashar5",
// 	"veryGood": 14,
// 	"timestamp": 1741151929390,
// 	"experienceGain": 7,
// 	"beatsReward": 46,
// 	"previousHighscore": 0
//   }


// {
// 	"_id": {
// 	  "$oid": "67c297853a6e708db8ed19d0"
// 	},
// 	"accuracy": 0.959349593495935,
// 	"artist": "X:IN",
// 	"bad": 0,
// 	"combo": 82,
// 	"difficulty": "easy",
// 	"finished": true,
// 	"good": 0,
// 	"maxCombo": 82,
// 	"miss": 0,
// 	"peerId": 152611201,
// 	"perfect": 72,
// 	"score": 731088,
// 	"songName": "No Doubt",
// 	"username": "nashar5",
// 	"veryGood": 10,
// 	"timestamp": 1740806021472,
// 	"experienceGain": 3,
// 	"beatsReward": 48,
// 	"previousHighscore": 676912
//   }