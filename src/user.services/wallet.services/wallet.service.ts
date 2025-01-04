//** THIRDWEB IMPORT * TYPES
import { Engine } from "@thirdweb-dev/engine";

//** CONFIG IMPORT
import { BEATS_TOKEN, GMR_TOKEN, ENGINE_ACCESS_TOKEN, ENGINE_URI, CHAIN } from "../../config/constants";

//**  TYPE INTERFACE
import { WalletData } from "../user.service.interface";

//** MEMGRAPH IMPORTS
import { QueryResult } from "neo4j-driver";
import { Driver, Session } from "neo4j-driver-core";


//** ERROR CODES
import ValidationError from '../../outputs/validation.error.js'

export const engine: Engine = new Engine({
  url: ENGINE_URI,
  accessToken: ENGINE_ACCESS_TOKEN,
  
});

class WalletService {
  driver?: Driver;
  constructor(driver?: Driver) {
    this.driver = driver;
  }


  //** Creates a wallet and returns the wallet address.
  public async createWallet(username: string): Promise<string> {
     try {
         // Create a new backend wallet with the player's username as the label
         const wallet = await engine.backendWallet.create({ label: username, type: "smart:local" });

         // Extract the wallet address from the response
         const { walletAddress } = wallet.result;

         return walletAddress as string;
     } catch (error: any) {
         console.error("Error creating player wallet:", error);
         throw error;
     }
   }

  public async getWalletBalance(walletAddress: string) {
    try {

      const [arbitrumToken, gmrToken, beatsToken] = await Promise.all([
        engine.backendWallet.getBalance(CHAIN, walletAddress),
        engine.erc20.balanceOf(walletAddress, CHAIN, GMR_TOKEN),
        engine.erc20.balanceOf(walletAddress, CHAIN, BEATS_TOKEN)
      ]);

      return {
        smartWalletAddress: walletAddress,
        beatsBalance: beatsToken.result.displayValue,
        gmrBalance: gmrToken.result.displayValue,
        nativeBalance: arbitrumToken.result.displayValue,
      } as WalletData;
    } catch (error: any) {
      throw error;
    }
  }


  public async getSmartWalletAddress(userName: string): Promise<string> {
    try {
        const session: Session | undefined = this.driver?.session();
        
        // Find the user node within a Read Transaction
        const result: QueryResult | undefined = await session?.executeRead(tx =>
            tx.run('MATCH (u:User {username: $userName}) RETURN u.smartWalletAddress AS smartWalletAddress', { userName })
        );

        await session?.close();
        
        // Verify the user exists
        if (result?.records.length === 0) {
            throw new ValidationError(`User with username '${userName}' not found.`, "");
        }

        // Retrieve the smartWalletAddress
        const smartWalletAddress: string = result?.records[0].get('smartWalletAddress');
        
        return smartWalletAddress;
    } catch (error: any) {
        console.log(error);
        throw error;
    }
  }

}


export default WalletService