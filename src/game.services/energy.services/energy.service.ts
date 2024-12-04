//** KEYDB IMPORTS
import { Driver, ManagedTransaction, QueryResult, Session } from "neo4j-driver-core";

//** SERVICE IMPORTS
import keydb from "../../db/keydb.client";
import TokenService from "../../user.services/token.services/token.service";

class EnergyService {

	private driver?: Driver;

	constructor(driver?: Driver) {
		this.driver = driver;
	}

	// Public function to get player's current energy and time until next recharge
	// Public function to get player's current energy and time until next recharge
	// public async getPlayerEnergy(token: string): Promise<{ energy: number; timeUntilNextRecharge: number | null }> {
	// 	const tokenService = new TokenService();
	// 	const username = await tokenService.verifyAccessToken(token);

	// 	// Ensure player energy data exists
	// 	await this.initializePlayerEnergyData(username);

	// 	const { lastEnergyUpdate, currentEnergy } = await this.getPlayerEnergyData(username);
	// 	const currentTime = Date.now();

	// 	const ENERGY_GAIN_PER_HOUR = 2;
	// 	const MS_PER_HOUR = 1000 * 60 * 60;
	// 	const BASE_MAX_ENERGY = 15;

	// 	const playerLevel = await this.getMaxEnergy(username);
	// 	const MAX_ENERGY = BASE_MAX_ENERGY + playerLevel;

	// 	const hoursPassed = Math.floor((currentTime - lastEnergyUpdate) / MS_PER_HOUR);
	// 	const energyToAdd = Math.min(ENERGY_GAIN_PER_HOUR * hoursPassed, MAX_ENERGY - currentEnergy);
	// 	const newEnergy = Math.min(currentEnergy + energyToAdd, MAX_ENERGY);

	// 	let timeUntilNextRecharge: number | null = null;
	// 	if (newEnergy < MAX_ENERGY) {
	// 		const nextRechargeTime = lastEnergyUpdate + (hoursPassed + 1) * MS_PER_HOUR;
	// 		timeUntilNextRecharge = nextRechargeTime - currentTime;
	// 	}

	// 	return { energy: newEnergy, timeUntilNextRecharge };
	// }


	public async getPlayerEnergyBeats(username: string): Promise<{ energy: number; timeUntilNextRecharge: number | null; maxEnergy: number }> {
		// Ensure player energy data exists
		await this.initializePlayerEnergyData(username);	
		const { lastEnergyUpdate, currentEnergy } = await this.getPlayerEnergyData(username);
		const currentTime = Date.now();
	
		const ENERGY_GAIN_PER_HOUR: number = 2;
		const MS_PER_HOUR: number = 1000 * 60 * 60;
		const BASE_MAX_ENERGY: number = 15;
	
		const playerLevel: number = await this.getMaxEnergy(username);
		const MAX_ENERGY: number = BASE_MAX_ENERGY + playerLevel;
	
		const hoursPassed: number = Math.floor((currentTime - lastEnergyUpdate) / MS_PER_HOUR);
		const energyToAdd: number = Math.min(ENERGY_GAIN_PER_HOUR * hoursPassed, MAX_ENERGY - currentEnergy);
		const newEnergy: number = Math.min(currentEnergy + energyToAdd, MAX_ENERGY);
	
		let timeUntilNextRecharge: number | null = null;
		if (newEnergy < MAX_ENERGY) {
			const nextRechargeTime = lastEnergyUpdate + (hoursPassed + 1) * MS_PER_HOUR;
			timeUntilNextRecharge = nextRechargeTime - currentTime;
		}
	
		return { energy: newEnergy, timeUntilNextRecharge, maxEnergy: MAX_ENERGY };
	}
	

	// Public function to use player energy
	public async usePlayerEnergy(username: string, apiKey: string, amount: number = 1): Promise<boolean> {

		const tokenService: TokenService = new TokenService();
		const isAuthorized: boolean = await tokenService.verifyApiKey(apiKey);
		if (!isAuthorized) {
			throw new Error("Unauthorized");
		}
		
		const { energy: currentEnergy } = await this.getPlayerEnergyBeats(username);

		if (currentEnergy >= amount) {
			await this.updatePlayerEnergy(username, {
				currentEnergy: currentEnergy - amount,
				lastEnergyUpdate: Date.now()
			});
			return true;
		}
		return false;
	}

	// Private helper function to get player data from Redis
	private async getPlayerEnergyData(username: string): Promise<{ currentEnergy: number; lastEnergyUpdate: number }> {
		try {
			const data = await keydb.HGETALL(`player:${username}`);
			return {
				currentEnergy: parseInt(data.currentEnergy, 10) || 0,
				lastEnergyUpdate: parseInt(data.lastEnergyUpdate, 10) || Date.now()
			};
		} catch (error: any) {
			console.error("Error fetching player energy data from Redis:", error);
			throw error;
		}
	}

	// Private helper function to update player data in Redis
	private async updatePlayerEnergy(username: string, data: { currentEnergy: number; lastEnergyUpdate: number }): Promise<void> {
		try {
			await keydb.HSET(`player:${username}`, {
				currentEnergy: data.currentEnergy,
				lastEnergyUpdate: data.lastEnergyUpdate
			});
		} catch (error: any) {
			console.error("Error updating player energy data in Redis:", error);
			throw error;
		}
	}

	// Private helper function to get player level from Neo4j
	private async getMaxEnergy(username: string): Promise<number> {
		const session: Session | undefined = this.driver?.session();
		let level: number = 1;

		try {
			const result: QueryResult | undefined = await session?.executeRead((tx: ManagedTransaction) =>
				tx.run(
					`MATCH (u:User {username: $username})
					 RETURN u.playerStats.level AS level`,
					{ username }
				)
			);

			const record = result?.records[0];
			if (record && record.has("level")) {
				level = record.get("level").toNumber(); // Convert Neo4j Integer to JavaScript number
			}
		} catch (error: any) {
			console.error("Error fetching player level from Neo4j:", error);
			throw error;
		} finally {
			await session?.close();
		}

		return level;
	}


    	// Function to initialize player energy data if it doesn't exist
	private async initializePlayerEnergyData(username: string): Promise<void> {
		const exists = await keydb.EXISTS(`player:${username}`);
		if (!exists) {
			const BASE_MAX_ENERGY = 15;
			const playerLevel = await this.getMaxEnergy(username);
			const maxEnergy = BASE_MAX_ENERGY + playerLevel;

			// Set initial energy to max energy and update the timestamp
			await keydb.HSET(`player:${username}`, {
				currentEnergy: maxEnergy,
				lastEnergyUpdate: Date.now()
			});
		}
	}
}

export default EnergyService;
