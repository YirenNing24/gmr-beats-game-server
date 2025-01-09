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

//** MONGODB IMPORT




class SoulService {

    driver?: Driver;
    constructor(driver?: Driver) {
        this.driver = driver;
    }

    public async createSoul(username: string, smartWalletAddress: string): Promise<void> {
        const walletService = new WalletService();
        try {

            const soulMetaData: SoulMetadata = {
                walletAddress: smartWalletAddress,
                name: username,
                description: `This is ${username}'s soul`,
                image: "",
                uploader: "beats", 
                accountAchievements: [{ rookie: true }],
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
            while (status.result.minedAt === null) {
              await new Promise((resolve) => setTimeout(resolve, 500)); 
              status = await engine.transaction.status(transaction.result.queueId);
            };

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
    



}

export default SoulService;