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

    public async createSoul(username: string): Promise<void> {
        const walletService = new WalletService();

        //**TODO check if a soul exists already */
        try {
            const smartWalletAddress: string = await walletService.getSmartWalletAddress(username);
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
            await engine.erc1155.mintBatchTo(CHAIN, SOUL_ADDRESS, ENGINE_ADMIN_WALLET_ADDRESS, requestBody);
        } catch (error: any) {
            console.log(error);
            throw error;
        }
    }
    



}

export default SoulService;