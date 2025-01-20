//** MEMGRAPH DRIVER AND TYPES
import { Driver, ManagedTransaction, QueryResult, RecordShape, Session } from "neo4j-driver";

//** ERROR CODES
import ValidationError from '../../outputs/validation.error'


//** CONFIGS
import { CHAIN, ENGINE_ADMIN_WALLET_ADDRESS, SOUL_ADDRESS } from "../../config/constants";


//** SERVICE IMPORTS
import WalletService, { engine } from "../../user.services/wallet.services/wallet.service";


//** TYPE INTERFACE IMPORT
import { SoulMetadata } from "./soul.service.interfrace";
import { getDriver } from "../../db/memgraph";
import { t } from "elysia";

//** MONGODB IMPORT




class SoulService {

    driver?: Driver;
    constructor(driver?: Driver) {
        this.driver = driver;
    }

    public async createSoul(username: string, smartWalletAddress: string): Promise<void> {
        const walletService = new WalletService(this.driver);
        try {

            const soulMetaData: SoulMetadata = {
                walletAddress: smartWalletAddress,
                name: username,
                description: `This is ${username}'s soul`,
                image: "",
                uploader: "beats", 
                accountAchievements: [{ rookie: true }],
                personalMissions: [],
                collectionMissions: [],
            };
    
            const metadataWithSupply = Array.from({ length: 1 }, () => ({
                metadata: { ...soulMetaData, },
                supply: "1" }
            ));

            const requestBody = {
                receiver: smartWalletAddress,
                metadataWithSupply,
            };
            const transaction = await engine.erc1155.mintBatchTo(CHAIN, SOUL_ADDRESS, ENGINE_ADMIN_WALLET_ADDRESS, requestBody);
            let status = await engine.transaction.status(transaction.result.queueId);
  
            // Wait for the transaction to be mined
			const maxRetries = 60; // Allow 30 seconds (60 * 500ms)
			let retries = 0;
	
			while (status.result.minedAt === null && retries < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms
				status = await engine.transaction.status(transaction.result.queueId);
				retries++;
			}

            await this.saveSoul(username, smartWalletAddress);

        } catch (error: any) {
            console.log(error);
            throw error;
        }
    }


    private async saveSoul(username: string, smartWalletAddress: string): Promise<void> {
        try {
            const transaction = await engine.erc1155.getOwned(smartWalletAddress, CHAIN, SOUL_ADDRESS);
            const soul = transaction.result[0];
            const id: string = soul.metadata.id;
            const session: Session | undefined = this.driver?.session();
            await session?.executeWrite(async (tx: ManagedTransaction) => {
                await tx.run(
                    `MATCH (u:User {username: $username})
                     SET u.soul = $soul
                        `,
                    { username, id, soul }
                )
            } );

        } catch (error: any) {
            console.error("Error saving soul:", error);
            throw error;
        }
    }


    public async updateSoulMetaData(username: string, missionName: string, missionType: string): Promise<void> {
        const walletService = new WalletService(this.driver);
        try {
            // Fetch user's soul and wallet address
            const soul: string = await walletService.getSoul(username);
            const smartWalletAddress: string = await walletService.getSmartWalletAddress(username);
    
            // Validate that the user has a soul
            if (!soul) {
                throw new ValidationError(`Soul for user ${username} not found.`, "");
            }
    
            // Fetch existing metadata of the soul NFT
            const soulNFT = await engine.erc1155.getOwned(smartWalletAddress, CHAIN, SOUL_ADDRESS);
            if (!soulNFT.result.length) {
                throw new ValidationError(`Soul NFT for user ${username} not found.`, "");
            }
    
            // Get the current metadata
            const currentSoulMetadata = soulNFT.result[0].metadata as unknown as SoulMetadata;
    
            // Determine which metadata field to update
            const metadataKey: keyof SoulMetadata = missionType === "personal" ? "personalMissions" : "collectionMissions";
    
            // Safely update the metadata array
            const updatedMetadata = { ...currentSoulMetadata }; // Create a copy of the metadata
            if (!Array.isArray(updatedMetadata[metadataKey])) {
                updatedMetadata[metadataKey] = []; // Initialize the array if it doesn't exist
            }
    
            // Add the new mission name to the array (avoid duplicates)
            if (!updatedMetadata[metadataKey].includes(missionName)) {
                updatedMetadata[metadataKey].push(missionName);
            }
    
            // Prepare the request body for the update
            const requestBody = {
                tokenId: soul,
                metadata: updatedMetadata,
            };
    
            // Update the metadata on-chain
            engine.erc1155.updateTokenMetadata(CHAIN, SOUL_ADDRESS, ENGINE_ADMIN_WALLET_ADDRESS, requestBody);
    
            console.log(`Soul metadata updated successfully for user: ${username}`);
    
        } catch (error: any) {
            console.error("Error updating soul metadata:", error);
            throw error;
        }
    }
    
    



}

export default SoulService;