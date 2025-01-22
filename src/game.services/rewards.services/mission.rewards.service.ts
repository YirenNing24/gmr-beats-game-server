//** MEMGRAPH DRIVER AND TYPES
import { Driver } from "neo4j-driver";

//** ERROR CODES
import ValidationError from '../../outputs/validation.error'

//** CONFIGS
import { BEATS_TOKEN, CHAIN, ENGINE_ADMIN_WALLET_ADDRESS, TREASURY_WALLET } from "../../config/constants";

//** SERVICE IMPORTS
import TokenService from "../../user.services/token.services/token.service";
import SoulService from "../soul.services/soul.service";


//** TYPE INTERFACE IMPORT
import { CollectionMission, CompletedMission, GetPersonalMission, PersonalMission, Reward, UserMissions } from "./reward.interface";
import WalletService, { engine } from "../../user.services/wallet.services/wallet.service";
import { SoulMetaData } from "../profile.services/profile.interface";
import { SuccessMessage } from "../../outputs/success.message";


//** MONGODB IMPORT
import { MongoClient } from "mongodb";
import { mongoDBClient } from "../../db/mongodb.client";
import { ClassicScoreStats } from "../leaderboard.services/leaderboard.interface";



class RewardService {

    driver?: Driver;
    constructor(driver?: Driver) {
        this.driver = driver;
    }


	public async getPersonalMissions(token: string): Promise<GetPersonalMission[]> {
		const tokenService = new TokenService();
		const client: MongoClient = await mongoDBClient.connect();
	
		try {
			// Verify the access token
			const username: string = await tokenService.verifyAccessToken(token);
			const collection = client.db("beats").collection("personalMissions");
			
			// Fetch all personal missions from the database
			const personalMissions = await collection
				.find({ missionType: "personal" })
				.toArray() as unknown as PersonalMission[];
	
			// Fetch the user's completed missions
			const userMissions = await this.getUserMissions(username);
	
			// Enrich missions with eligibility and claim status
			const enrichedMissions: GetPersonalMission[] = await Promise.all(
				personalMissions.map(async (mission) => {
					const completedMission = userMissions?.completedMissions.find(
						(completed) => completed.missionName === mission.name
					);
			
					if (completedMission && completedMission.rewardClaimed) {
						// If the mission is already completed and claimed
						return {
							...mission,
							elligible: false, // Already claimed, so not eligible
							claimed: true    // Reward already claimed
						};
					} else {
						// If not claimed, check for eligibility
						const eligible: boolean = await this.checkPersonalMissionEligibility(username, mission);
						return {
							...mission,
							elligible: eligible,
							claimed: false   // Not yet claimed
						};
					}
				})
			);
			
			await client.close();

			return enrichedMissions;
		} catch (error: any) {
			console.error("Error fetching personal missions:", error);
			throw error;
		} finally {
			await client.close(); // Ensure the database connection is closed in case of an error
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


	public async claimPersonalMissionReward(token: string, missionName: {name: string}): Promise<SuccessMessage> {
		const tokenService = new TokenService();
		const soulService = new SoulService(this.driver);

		try {
			const { name } = missionName
			const username: string = await tokenService.verifyAccessToken(token);
			const client: MongoClient = await mongoDBClient.connect();
			const collection = client.db("beats").collection("personalMissions");


			const missionData = await collection.findOne({ name }) as unknown as PersonalMission;
			if (!missionData) {
				throw new ValidationError("Mission not found", "Mission not found");
			}
			// Validate the mission type
			if (missionData.missionType !== "personal") {
				throw new ValidationError("Invalid mission type", "Invalid mission type");
			}
	
			// Check eligibility
			const eligibility: boolean = await this.checkPersonalMissionEligibility(username, missionData);
			if (!eligibility) {
				throw new ValidationError("User is not eligible for the reward", "User is not eligible for the reward");
			}
	
			// Check if the mission has already been claimed
			const userMissions = await this.getUserMissions(username);
	
			if (userMissions !== null) {
				// User has missions recorded; check for duplicates
				const completedMission = userMissions.completedMissions.find(
					(mission) => mission.missionName ===  name 
				);
	
				if (completedMission && completedMission.rewardClaimed) {
					throw new ValidationError("Reward for this mission has already been claimed", "Reward already claimed");
				}
			}
	
			// Award the reward
			await this.giveReward(username, missionData.requirement.criteria.reward, "BEATS");
	
			// Update the user's mission data
			await this.updateUserMission(username, name);
	
			// Update Soul Metadata
			// soulService.updateSoulMetaData(username, name, "personal");
	
			// Close the database connection
			await client.close();
	
			return new SuccessMessage("Personal mission reward claimed successfully");
		} catch (error: any) {
			console.error("Error claiming personal mission reward:", error);
			throw error;
		}
	}
	
	

	private async updateUserMission(username: string, missionName: string): Promise<void> {
		const client: MongoClient = await mongoDBClient.connect();
		const soulService = new SoulService(this.driver);
		try {
			const userMissionsCollection = client.db("beats").collection("missionsCompleted");
	
			// Fetch or initialize the user's mission record
			const userMissions = await userMissionsCollection.findOne({ username }) ?? {
				username,
				completedMissions: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			} as unknown as UserMissions;
	
			// Add the completed mission to the user's record
			const completedMission: CompletedMission = {
				missionName,
				completedAt: new Date().toISOString(),
				rewardClaimed: true
			};
	
			userMissions.completedMissions.push(completedMission);
			userMissions.updatedAt = new Date().toISOString();
	
			// Save the updated user missions back to the database
			await userMissionsCollection.updateOne(
				{ username },
				{ $set: userMissions },
				{ upsert: true }
			);
		} catch (error: any) {
			console.error("Error updating user mission:", error);
			throw error;
		} finally {
			await client.close(); // Ensure the database connection is closed
		}
	}


	private async getUserMissions(username: string): Promise<UserMissions | null> {
		const client: MongoClient = await mongoDBClient.connect();
		try {
			const userMissionsCollection = client.db("beats").collection("missionsCompleted");
	
			// Fetch the user's mission record
			const userMissions = await userMissionsCollection.findOne({ username }) as UserMissions | null;
	
			return userMissions;
		} catch (error: any) {
			console.error("Error fetching user missions:", error);
			throw error;
		} finally {
			await client.close(); // Ensure the database connection is closed
		}
	}
	

	private async checkPersonalMissionEligibility(username: string, missionData: PersonalMission): Promise<boolean> {
		try {
			let verified = false;
	
			// Destructure for easier access
			const { type, value: requirementValue } = missionData.requirement.criteria;
	
			if (type === "uniqueSongs") {
				
				verified = await this.checkCompletedSongs(username, requirementValue);
			}
			return verified;
		} catch (error: any) {
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
	
			// Use a Set to filter out duplicate song names
			const uniqueSongs = new Set(scores.map(score => score.songName));
	
			// Check if the number of unique songs meets the requirement
			return uniqueSongs.size >= value;
		} catch (error: any) {
			console.error("Error in checkCompletedSongs: ", error);
			throw error;
		}
	}
	


	private async giveReward(username: string, rewardData: Reward, rewardType: string): Promise<void> {
		const walletService = new WalletService(this.driver);
		const smartWalletAddress: string = await walletService.getSmartWalletAddress(username);
		const soulService: SoulService = new SoulService(this.driver);
		try {
			const soul: string = await walletService.getSoul(username);
			if (soul === "") {
				await soulService.createSoul(username, smartWalletAddress);
			}

			if (rewardType === "BEATS") {
				await this.sendBeatsReward(smartWalletAddress, rewardData.amount.toString());
			}
		
		} catch (error: any) {
			console.error("Error in giveReward: ", error);
			throw error;
		}

	}


	public async sendBeatsReward(smartWalletAddress: string, beatsAmount: string): Promise<void> {
		try {
			const setAllowanceBody = { spenderAddress: ENGINE_ADMIN_WALLET_ADDRESS, amount: beatsAmount };
			const transaction = await engine.erc20.setAllowance(CHAIN, BEATS_TOKEN, TREASURY_WALLET, setAllowanceBody);
	
			let status = await engine.transaction.status(transaction.result.queueId);
	
			// Retry loop with timeout
			const maxRetries = 60; // Allow 30 seconds (60 * 500ms)
			let retries = 0;
	
			while (status.result.minedAt === null && retries < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms
				status = await engine.transaction.status(transaction.result.queueId);
				retries++;
			}
	
			if (status.result.minedAt === null) {
				throw new Error("Transaction not mined within the expected timeframe.");
			}
	
			const transferBody = { toAddress: smartWalletAddress, fromAddress: TREASURY_WALLET, amount: beatsAmount };
			await engine.erc20.transferFrom(CHAIN, BEATS_TOKEN, ENGINE_ADMIN_WALLET_ADDRESS, transferBody);
	
		} catch (error: any) {
			console.error("Error in sendBeatsReward: ", error);
			throw error;
		}
	}
	

}

export default RewardService;


