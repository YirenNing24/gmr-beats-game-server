import { mongoDBClient } from "./src/db/mongodb.client";
import { Db } from "mongodb";

function runRaffle(entries) {
	// Remove users with 0 entries
	const validEntries = Object.entries(entries).filter(([_, count]) => count > 0);

	// Create a weighted pool of names
	let pool = [];
	for (const [name, count] of validEntries) {
		for (let i = 0; i < count; i++) {
			pool.push(name);
		}
	}

	const winners = new Set();

	while (winners.size < 1 && pool.length > 0) {
		const randomIndex = Math.floor(Math.random() * pool.length);
		const winner = pool[randomIndex];
		winners.add(winner);

		// Remove all instances of the winner from the pool
		pool = pool.filter(name => name !== winner);
	}

	return [...winners];
}

const entries = {
	Able_Haeunie: 13,
	Goddess: 15,
	khaelrocks: 13,
	Nacht18: 15,
	Gelatine: 0,
	c2nagreen: 14,
	bbangyunha: 2,
	chenry124: 13,
	Arasqvs: 18,
  }
 console.log("Winners:", runRaffle(entries));


interface ClassicScoreStats {
	difficulty: string;
	score: number;
	combo: number;
	maxCombo: number;
	accuracy: number;
	finished: boolean;
	songName: string;
	artist: string;
	perfect: number;
	veryGood: number;
	good: number;
	bad: number;
	miss: number;
	username: string;
	gameId: string;
	timestamp: number; // UNIX timestamp in milliseconds
}

async function getRaffleEntries(db: Db): Promise<Record<string, number>> {
	try {
		const collection = db.collection<ClassicScoreStats>("classicScores");

		// List of usernames to check
		const validUsernames = [
			"Able_Haeunie",
			"Goddess",
			"khaelrocks",
			"gelatine",
			"Nacht18",
			"c2nagreen",
			"bbangyunha",
			"chenry124",
			"Arasqvs"
		]

		// Aggregate to count scores per username per day
		const scoresPerUser = await collection
			.aggregate([
				{
					$match: {
						username: { $in: validUsernames } // Filter only selected usernames
					}
				},
				{
					$project: {
						username: 1,
						date: {
							// Convert timestamp to YYYY-MM-DD format
							$toDate: "$timestamp"
						}
					}
				},
				{
					$group: {
						_id: {
							username: "$username",
							day: {
								$dateToString: { format: "%Y-%m-%d", date: "$date" } // Group by day
							}
						},
						scoreCount: { $sum: 1 }
					}
				},
				{
					$match: {
						scoreCount: { $gte: 3 } // Only count if at least 3 scores in a day
					}
				},
				{
					$group: {
						_id: "$_id.username",
						entries: { $sum: 1 } // Count unique days where 3+ scores exist
					}
				},
				{
					$project: {
						_id: 0,
						username: "$_id",
						entries: 1
					}
				}
			])
			.toArray();

		// Convert to a record format { username: entries }, default to 0 if user has no scores
		const raffleEntries: Record<string, number> = {};
		for (const username of validUsernames) {
			const userEntry = scoresPerUser.find(user => user.username === username);
			raffleEntries[username] = userEntry ? userEntry.entries : 0;
		}

		return raffleEntries;
	} catch (error) {
		console.error("Error fetching raffle entries:", error);
		throw error;
	}
}

// Usage example
// (async () => {
// 	const db: Db = mongoDBClient.db("beats");
// 	const raffleEntries = await getRaffleEntries(db);
// 	console.log(raffleEntries);
// })();