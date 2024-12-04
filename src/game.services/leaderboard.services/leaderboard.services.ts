//** MEMGRAPH DRIVER AND TYPES
import { Driver } from "neo4j-driver";

//** VALIDATION ERROR
import { ClassicScoreStats, LeaderboardQuery } from "./leaderboard.interface";

//** SERVICE IMPORT
import TokenService from "../../user.services/token.services/token.service";

//** RETHINK DB IMPORT
import rt from "rethinkdb";
import { getRethinkDB } from "../../db/rethink";



class LeaderboardService {
	driver?: Driver;
	constructor(driver?: Driver) {
		this.driver = driver;
	}

	public async leaderboard(token: string, query: LeaderboardQuery): Promise<ClassicScoreStats[]> {
		try {

			const tokenService: TokenService = new TokenService();
			await tokenService.verifyAccessToken(token);
		
			const { songName, difficulty, period } = query;
			const songTitle: string = this.correctSongName(songName)

			const { startOfPeriod, endOfPeriod } = this.getPeriodDates(period);
			const scores: ClassicScoreStats[] = await this.fetchScores(songTitle, difficulty.toLowerCase());
			const filteredScores: ClassicScoreStats[] = this.filterScoresByPeriod(scores, startOfPeriod, endOfPeriod);

			return filteredScores;
		} catch (error: any) {
			console.log(error);
			throw error;
		}
	}

	private correctSongName(songName: string): string {
		let songTItle: string = songName
		if (songName == "NoDoubt") {
			songTItle = "No Doubt"
		}
		return songTItle
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

	
	private async fetchScores(songName: string, difficulty: string): Promise<ClassicScoreStats[]> {
		const connection: rt.Connection = await getRethinkDB();
		const result: rt.Cursor = await rt.db('beats')
			.table('classicScores')
			.filter(rt.row('songName').eq(songName).and(rt.row('difficulty').eq(difficulty)))
			.run(connection);

		const scores: ClassicScoreStats[] = await result.toArray();

		return scores;
	}

	private filterScoresByPeriod(scores: ClassicScoreStats[], startOfPeriod: Date, endOfPeriod: Date): ClassicScoreStats[] {
		return scores.filter(score => {
			const scoreDate = new Date(score.timestamp);
			return scoreDate >= startOfPeriod && scoreDate < endOfPeriod;
		});
	}
}

export default LeaderboardService;
