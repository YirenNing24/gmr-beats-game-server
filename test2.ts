
import { ClassicScoreStats } from "./src/game.services/leaderboard.services/leaderboard.interface";
import { mongoDBClient } from "./src/db/mongodb.client";

export async function getPlayerHighScorePerSong(): Promise<ClassicScoreStats[]> {
	try {

		const client = await mongoDBClient.connect();
		const db = client.db("beats");
		const collection = db.collection<ClassicScoreStats>("classicScores");

		const highScores = await collection
			.aggregate([
				{ $match: { username: "c2nagreen" } },
				{ $sort: { score: -1, timestamp: -1 } },
				{
					$group: {
						_id: {
							songName: "$songName",
							difficulty: "$difficulty"
						},
						songName: { $first: "$songName" },
						difficulty: { $first: "$difficulty" },
						score: { $first: "$score" },
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
						gameId: { $first: "$gameId" }
					}
				},
				{ $sort: { score: -1 } }
			])
			.toArray();

		const formattedScores = highScores.map(({ _id, ...rest }) => rest) as ClassicScoreStats[];

		await client.close();
        console.log(formattedScores)

		return formattedScores;
	} catch (error: any) {
		console.error("Error fetching high scores:", error);
		throw error;
	}
}

getPlayerHighScorePerSong()