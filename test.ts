import { mongoDBClient } from "./src/db/mongodb.client";


const leaderboard = async () => {
	try {


const getPeriodDates = (period: string) => {
	const now = new Date();
	let startOfPeriod;
	let endOfPeriod;

	switch (period) {
		case "Daily":
			startOfPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
			endOfPeriod = new Date(startOfPeriod);
			endOfPeriod.setUTCDate(startOfPeriod.getUTCDate() + 1);
			break;

		case "Yesterday":
			startOfPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0));
			endOfPeriod = new Date(startOfPeriod);
			endOfPeriod.setUTCDate(startOfPeriod.getUTCDate() + 1);
			break;

		case "TwoDaysAgo":
			startOfPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2, 0, 0, 0, 0));
			endOfPeriod = new Date(startOfPeriod);
			endOfPeriod.setUTCDate(startOfPeriod.getUTCDate() + 1);
			break;

		case "Weekly":
			const dayOfWeek = now.getUTCDay();
			const diffToMonday = (dayOfWeek + 6) % 7;
			startOfPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday, 0, 0, 0, 0));
			endOfPeriod = new Date(startOfPeriod);
			endOfPeriod.setUTCDate(startOfPeriod.getUTCDate() + 7);
			break;

		case "Monthly":
			startOfPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
			endOfPeriod = new Date(startOfPeriod);
			endOfPeriod.setUTCMonth(startOfPeriod.getUTCMonth() + 1);
			break;

		default:
			throw new Error("Invalid period specified");
	}

	return { startOfPeriod, endOfPeriod };
};

		const songTitle = correctSongName("The Chase");
		const { startOfPeriod, endOfPeriod } = getPeriodDates("TwoDaysAgo");
		const scores = await fetchScores(songTitle, "ultra hard");

		const filteredScores = scores
			.filter(score => {
				const scoreDate = new Date(score.timestamp);
				return scoreDate >= startOfPeriod && scoreDate < endOfPeriod && score.score > 0;
			})
			.sort((a, b) => b.score - a.score);

		return filteredScores;
	} catch (error) {
		console.log(error);
		throw error;
	}
};

const getPeriodDates = (period: string) => {
	const now = new Date();
	let startOfPeriod;
	let endOfPeriod;

	switch (period) {
		case "Daily":
			startOfPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
			endOfPeriod = new Date(startOfPeriod);
			endOfPeriod.setUTCDate(startOfPeriod.getUTCDate() + 1);
			break;

		case "Yesterday":
			startOfPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0));
			endOfPeriod = new Date(startOfPeriod);
			endOfPeriod.setUTCDate(startOfPeriod.getUTCDate() + 1);
			break;

		case "Weekly":
			const dayOfWeek = now.getUTCDay();
			const diffToMonday = (dayOfWeek + 6) % 7;
			startOfPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday, 0, 0, 0, 0));
			endOfPeriod = new Date(startOfPeriod);
			endOfPeriod.setUTCDate(startOfPeriod.getUTCDate() + 7);
			break;

		case "Monthly":
			startOfPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
			endOfPeriod = new Date(startOfPeriod);
			endOfPeriod.setUTCMonth(startOfPeriod.getUTCMonth() + 1);
			break;

		default:
			throw new Error("Invalid period specified");
	}

	return { startOfPeriod, endOfPeriod };
};


const fetchScores = async (songName: string, difficulty: string) => {
	try {
		await mongoDBClient.connect();
		const db = mongoDBClient.db("beats");
		const collection = db.collection("classicScores");

		const scores = await collection
			.find({ songName: songName, difficulty: difficulty })
			.toArray();
		await mongoDBClient.close();
		return scores;
	} catch (error) {
		console.error("Error fetching scores:", error);
		throw error;
	}
};



const correctSongName = (songName: string) =>{
	// Insert a space before capital letters (except for the first letter)
	let songTitle: string = songName.replace(/([a-z])([A-Z])/g, "$1 $2");

	return songTitle;
}


console.log(await leaderboard())
