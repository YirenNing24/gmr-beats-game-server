//** MEMGRAPH DRIVER AND TYPES
import { Driver, ManagedTransaction, QueryResult, RecordShape, Session } from "neo4j-driver";

//** ERROR CODES
import ValidationError from '../../outputs/validation.error'

//** CONFIGS
import { BEATS_TOKEN, CHAIN, ENGINE_ADMIN_WALLET_ADDRESS, PRIVATE_KEY, SECRET_KEY, SOCIAL_BADGES_ADDRESS, SOUL_ADDRESS } from "../../config/constants";

//** SERVICE IMPORTS
import TokenService from "../../user.services/token.services/token.service";
import { SoulMetaData } from "../profile.services/profile.interface";
import { SuccessMessage } from "../../outputs/success.message";


//** TYPE INTERFACE IMPORT
import { CardOwned, CollectionMission, PersonalMission, RewardData } from "./reward.interface";
import { engine } from "../../user.services/wallet.services/wallet.service";
import { MongoClient } from "mongodb";

//** MONGODB IMPORT
import { mongoDBClient } from "../../db/mongodb.client";
import { ClassicScoreStats } from "../leaderboard.services/leaderboard.interface";


class RewardService {

    driver?: Driver;
    constructor(driver?: Driver) {
        this.driver = driver;
    }
	public async hasCompletedThreeUniqueSongs(username: string): Promise<boolean> {
		try {
			const client: MongoClient = await mongoDBClient.connect();
			const collection = client.db("beats").collection("classicScores");

			// Query to find completed scores for the given username
			const scores = await collection
				.find<ClassicScoreStats>({ username, finished: true })
				.project({ songName: 1 })
				.toArray();

			// Extract unique song names
			const uniqueSongs: Set<any> = new Set(scores.map((score) => score.songName));

			// Check if there are at least three unique songs
			return uniqueSongs.size >= 3;
		} catch (error: any) {
			console.error("Error in hasCompletedThreeUniqueSongs: ", error);
			throw error;
		}
	}

	
	public async getPersonalMissions(token: string): Promise<PersonalMission[]> {

		const tokenService = new TokenService();
		try {
			await tokenService.verifyAccessToken(token);
			const client: MongoClient = await mongoDBClient.connect();
			const collection = client.db("beats").collection("personalMissions");
	
			const personalMissions = await collection.find({ missionType: "personal" }).toArray() as unknown as PersonalMission[];
	
			await client.close(); // Close the client after the operation
			return personalMissions;
		} catch (error: any) {
			console.error("Error fetching personal missions:", error);
			throw error;
		}
	}


	public async getCollectionMissions(token: string): Promise<CollectionMission[]> {
		const tokenService = new TokenService();
		try {
			await tokenService.verifyAccessToken(token);
			const client: MongoClient = await mongoDBClient.connect();
			const collection = client.db("beats").collection("collectionMissions");
	
			const collectionMissions = await collection.find({ missionType: "collection" }).toArray() as unknown as CollectionMission[];
	
			await client.close(); // Close the client after the operation
			return collectionMissions;
		} catch (error: any) {
			console.error("Error fetching collection missions:", error);
			throw error;
		}
	}


    







    
    
}

export default RewardService;


