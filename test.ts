import { mongoDBClient } from "./src/db/mongodb.client";
import { Db } from "mongodb";

function runRaffle(entries: any) {
	// Remove users with 0 entries
	const validEntries = Object.entries(entries).filter(([_, count]) => count > 0);

	// Create a weighted pool of names
	let pool: string[] = [];
	for (const [name, count] of validEntries) {
		for (let i = 0; i < count; i++) {
			pool.push(name);
		}
	}

	if (pool.length === 0) {
		console.log("Uh-oh... nobody entered the raffle! Guess I'll keep the prize. 😏");
		return [];
	}

	console.log("🎉 The raffle is starting! Get ready! 🎉");

	let timeLeft = 10;
	const interval = setInterval(() => {
		const funnyMessages = [
			`⏳ ${timeLeft} seconds left... someone's sweating already! 😅`,
			`💀 ${timeLeft} seconds... someone's praying right now. 🙏`,
			`🎶 ${timeLeft} seconds... cue the dramatic drumroll! 🥁`,
			`🤡 ${timeLeft} seconds... rigged? No, just ✨random✨`,
			`🔥 ${timeLeft} seconds... someone's luck is about to explode! 💥`,
			`💸 ${timeLeft} seconds... better start writing your victory speech! 📝`,
			`🚀 ${timeLeft} seconds... tension rising, palms sweating! 😰`,
			`🎰 ${timeLeft} seconds... jackpot or heartbreak? Let's see! 🎲`,
			`🎭 ${timeLeft} seconds... Will you win? Will you cry? Stay tuned! 📢`,
			`🏆 ${timeLeft} seconds... last chance to bribe the RNG gods! 👀`
		];
		console.log(funnyMessages[10 - timeLeft]);

		timeLeft--;
	}, 1000);

	return new Promise<string[]>((resolve) => {
		setTimeout(() => {
			clearInterval(interval);

			const winners = new Set<string>();

			while (winners.size < 1 && pool.length > 0) {
				const randomIndex = Math.floor(Math.random() * pool.length);
				const winner = pool[randomIndex];
				winners.add(winner);

				// Remove all instances of the winner from the pool
				pool = pool.filter(name => name !== winner);
			}

			console.log(`🎊 And the winner is... 🥁🥁🥁 ${[...winners][0]}! Congratulations! 🎊`);
			resolve([...winners]);
		}, 10000);
	});
}

// const entries = {
// 	khaelrocks: 15,
// 	laurence27: 16,
// 	mirajane: 29,
// 	chenry124: 13,
// 	Chuna: 14,
// 	Goddess: 13,
// 	CieloQ281993: 5,
// 	Raquel_05: 9,
// 	chabechabs: 11,
// 	Ampot: 10,
// 	jjanee: 15,
// 	dnicanics05: 17,
// 	wena: 26,
// 	belen: 21,
// 	jenelyn: 15,
// 	map02: 1,
// 	edz5: 3,
// 	kateyyy: 0,
// 	ken_ken: 1,
// 	kaye: 2,
// 	karl: 1,
// 	Gabo: 2,
// 	rodalyn23: 3,
//   }

const entries = {
		Able_Haeunie: 16,
		Goddess: 21,
		khaelrocks: 15,
		Nacht18: 16,
		Gelatine: 1,
		c2nagreen: 18,
		bbangyunha: 2,
		chenry124: 14,
		Arasqvs: 21,
		ashlee_beer: 1,
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
				"Nacht18",
				"Gelatine",
				"c2nagreen",
				"bbangyunha",
				"chenry124",
				"Arasqvs",
				"ashlee_beer"
		

		];
		

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



// // Usage example
//   (async () => {
//   	const db: Db = mongoDBClient.db("beats");
//   	const raffleEntries = await getRaffleEntries(db);
//   	console.log(raffleEntries); })();