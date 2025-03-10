//** MEMGRAPH DRIVER AND TYPES
import { Driver } from "neo4j-driver";

//** VALIDATION ERROR
import { LeaderboardQuery, savedClassicScoreStats } from "./leaderboard.interface";

//** SERVICE IMPORT
import TokenService from "../../user.services/token.services/token.service";

//** MONGO DB CLIENT
import { mongoDBClient } from "../../db/mongodb.client";
import { Db } from "mongodb";



class LeaderboardService {
	driver?: Driver;
	constructor(driver?: Driver) {
		this.driver = driver;
	}

	public async leaderboard(token: string, query: LeaderboardQuery): Promise<savedClassicScoreStats[]> {
		try {
			const tokenService: TokenService = new TokenService();
			await tokenService.verifyAccessToken(token);
		
			const { songName, difficulty, period } = query;
			const songTitle: string = this.correctSongName(songName);
	
			const { startOfPeriod, endOfPeriod } = this.getPeriodDates(period);
			const scores: savedClassicScoreStats[] = await this.fetchScores(songTitle, difficulty.toLowerCase());

			// Apply filters and sort correctly
			const filteredScores = scores
				.filter(score => {
					const scoreDate = new Date(score.timestamp);
					return scoreDate >= startOfPeriod && scoreDate < endOfPeriod && score.score > 0;
				})
				.sort((a, b) => b.score - a.score); // Ensure highest score is first
	
			return filteredScores;
		} catch (error: any) {
			console.log(error);
			throw error;
		}
	}
	

	private correctSongName(songName: string): string {
		// Insert a space before capital letters (except for the first letter)
		let songTitle: string = songName.replace(/([a-z])([A-Z])/g, "$1 $2");
	
		return songTitle;
	}
	

	private getPeriodDates(period: string): { startOfPeriod: Date; endOfPeriod: Date } {
		const now = new Date();
		let startOfPeriod: Date;
		let endOfPeriod: Date;

		switch (period) {
			case "Daily":
				startOfPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
				endOfPeriod = new Date(startOfPeriod);
				endOfPeriod.setUTCDate(startOfPeriod.getUTCDate() + 1);
				break;

			case "Weekly":
				const dayOfWeek = now.getUTCDay(); // Sunday - Saturday: 0 - 6
				const diffToMonday = (dayOfWeek + 6) % 7; // Calculate how many days to subtract to get to Monday
				startOfPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday, 0, 0, 0, 0));
				endOfPeriod = new Date(startOfPeriod);
				endOfPeriod.setUTCDate(startOfPeriod.getUTCDate() + 7); // Add 7 days to Monday to get the next Monday
				break;

			case "Monthly":
				startOfPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
				endOfPeriod = new Date(startOfPeriod);
				endOfPeriod.setUTCMonth(startOfPeriod.getUTCMonth() + 1); // Add 1 month
				break;

			default:
				throw new Error("Invalid period specified");
		}

		return { startOfPeriod, endOfPeriod };
	}
	
	
	private async fetchScores(songName: string, difficulty: string): Promise<savedClassicScoreStats[]> {
		try {
			// Connect to the database using the shared client
			await mongoDBClient.connect();
			const db: Db = mongoDBClient.db("beats");
			const collection = db.collection<savedClassicScoreStats[]>("classicScores");

			// Query the collection
			const scores = await collection
				.find({ songName: songName, difficulty: difficulty })
				.toArray();
			await mongoDBClient.close();
			return scores as unknown as savedClassicScoreStats[];
		} catch (error) {
			console.error("Error fetching scores:", error);
			throw error;
		}
	}


}

export default LeaderboardService;
