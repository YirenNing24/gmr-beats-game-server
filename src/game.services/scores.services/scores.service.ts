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
	
			// Establish MongoDB connection
			client = await mongoDBClient.connect();
			const db = client.db("beats");
			const collection = db.collection("classicScores");
	
			// Execute async tasks in parallel
			const [experienceGain, beatsReward, previousHighscore] = await Promise.all([
				this.calculateExperience(username, score.accuracy),
				songRewardService.classicSongReward(score),
				this.getHighScoreIndividual(score.songName, username, db)
			]);
	
			// Prepare the score object
			const scoreWithRewards = {
				...score,
				timestamp: Date.now(),
				experienceGain: experienceGain.experienceGained,
				beatsReward,
				previousHighscore
			};
	
			// Use bulkWrite to insert the score and update highscore efficiently
			await collection.bulkWrite([
				{ insertOne: { document: scoreWithRewards } }, // Insert new score
				{ 
					updateOne: {
						filter: { songName: score.songName, username },
						update: { $max: { highscore: score.score } } // Update highscore only if it's higher
					} 
				}
			]);
	
			// Add rewards to the experience result
			experienceGain.beatsReward = beatsReward;
			experienceGain.previousHighscore = previousHighscore;
	
			return experienceGain;
		} catch (error: any) {
			console.error("Error saving classic score:", error);
			throw error;
		} finally {
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