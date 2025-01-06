//** MEMGRAPH DRIVER AND TYPES
import { Driver, ManagedTransaction, QueryResult, RecordShape, Session } from "neo4j-driver";

//** ERROR CODES
import ValidationError from '../../outputs/validation.error'

//** THIRDWEB IMPORTS


//** CONFIGS
import { BEATS_TOKEN, CHAIN, ENGINE_ADMIN_WALLET_ADDRESS, PRIVATE_KEY, SECRET_KEY, SOCIAL_BADGES_ADDRESS, SOUL_ADDRESS } from "../../config/constants";

//** SERVICE IMPORTS


//** TYPE INTERFACE IMPORT

//** MONGODB IMPORT




class SoulService {

    driver?: Driver;
    constructor(driver?: Driver) {
        this.driver = driver;
    }



    public async createSoul() {


    }



}