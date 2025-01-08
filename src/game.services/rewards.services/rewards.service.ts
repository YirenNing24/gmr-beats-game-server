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

//** RETHINK DB IMPORT
import rt from "rethinkdb";
import { getRethinkDB } from "../../db/rethink";

//** TYPE INTERFACE IMPORT
import { CardOwned, CollectionMission, PersonalMission, Reward, RewardData } from "./reward.interface";
import WalletService, { engine } from "../../user.services/wallet.services/wallet.service";
import { MongoClient } from "mongodb";

//** MONGODB IMPORT
import { mongoDBClient } from "../../db/mongodb.client";
import { ClassicScoreStats } from "../leaderboard.services/leaderboard.interface";


class RewardService {

    driver?: Driver;
    constructor(driver?: Driver) {
        this.driver = driver;
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


	public async claimPersonalMissionReward(token: string, missionData: PersonalMission): Promise<SuccessMessage> {
		const tokenService = new TokenService();
		try {
			if( missionData.missionType !== "personal") {
				throw new ValidationError("Invalid mission type", "Invalid mission type");
			}

			const username = await tokenService.verifyAccessToken(token);
			const client: MongoClient = await mongoDBClient.connect();
			const collection = client.db("beats").collection("personalMissions");

			const { name } = missionData;
			const personalMission = await collection.findOne({ name }) as unknown as PersonalMission;
			const eligibility = await this.checkPersonalMissionEligibility(username, personalMission);

			if (!eligibility) {
				throw new ValidationError("User is not eligible for the reward", "User is not eligible for the reward");
			}


			return new SuccessMessage("Personal mission claimed successfully");
		} catch (error: any) {
			console.error("Error claiming personal mission reward:", error);
			throw error;
		}
	}


	private async checkPersonalMissionEligibility(username: string, missionData: PersonalMission): Promise<boolean> {
		try {
			let verified = false;
			const type = missionData.requirement.criteria.type;
			const requirementValue = missionData.requirement.criteria.value;
			if (type === "uniqueSongs") {
				verified = await this.checkCompletedSongs(username, requirementValue);
			};

			if (verified) {
				await this.giveReward(username, missionData.requirement.criteria.reward);
			}



			return verified;
		}	catch (error: any) {
			console.error("Error checking personal mission eligibility:", error);
			throw error;
		}

	}    

	private async checkCompletedSongs(username: string, value: number): Promise<boolean> {
		try {
			const client: MongoClient = await mongoDBClient.connect();
			const collection = client.db("beats").collection("classicScores");

			// Query to find completed scores for the given username
			const scores = await collection
				.find<ClassicScoreStats>({ username, finished: true })
				.project({ songName: 1 })
				.toArray();

			// Check if the song has been completed
			return scores.length > value;
		} catch (error: any) {
			console.error("Error in checkCompletedSongs: ", error);
			throw error;
		}
	}


	private async giveReward(username: string, rewardData: Reward): Promise<void> {
		const walletService = new WalletService();
		try {
			const smartWalletAddress = await walletService.getSmartWalletAddress(username);

			





		} catch (error: any) {
			console.error("Error in giveReward: ", error);
			throw error;
		}

	}




    
    
}

export default RewardService;


