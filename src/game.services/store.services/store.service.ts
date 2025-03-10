//** MEMGRAPH IMPORTS
import { BEATS_TOKEN, CARD_MARKETPLACE, PACK_MARKETPLACE } from "../../config/constants";
import { Driver, Session, ManagedTransaction, QueryResult, RecordShape } from "neo4j-driver-core";

//** CONFIG IMPORTs
import { CHAIN } from "../../config/constants";

//** VALIDATION IMPORT
import ValidationError from "../../outputs/validation.error";

//** SERVICE IMPORTS
import TokenService from "../../user.services/token.services/token.service";
import { engine } from "../../user.services/wallet.services/wallet.service";

//** TYPE INTERFACE IMPORTs
import { BuyCardData, StoreCardData, StoreCardUpgradeData, StorePackData } from "./store.interface";
import { UserData } from "../../user.services/user.service.interface";


//** CYPHER IMPORTS
import { buyCardCypher, getValidCardPacks, getValidCardUpgrades } from "./store.cypher";

//** SUCCESS MESSAGE IMPORT
import { SuccessMessage } from "../../outputs/success.message";




export default class StoreService {
  driver: Driver;
  constructor(driver: Driver) {
    this.driver = driver;
  }

  //Retrieves valid cards from the using the provided access token.
  public async getValidCards(token: string): Promise<StoreCardData[]> {
    try {
      const tokenService = new TokenService();
      const username = await tokenService.verifyAccessToken(token);
  
      // ✅ Return empty array if username is NOT "hotness29"
      if (username !== "hotness29") {
        return [];
      }
  
      const listed = (await engine.marketplaceDirectListings.getAllValid(CHAIN, CARD_MARKETPLACE)).result;
  
      // Transform listings into StoreCardData format
      const finalCardData: StoreCardData[] = listed.map((listing) => {
        const asset = listing.asset as StoreCardData;
        const scaledPrice = Number(BigInt(listing.pricePerToken) / BigInt(10 ** 18));
  
        return {
          ...asset, // Spread metadata key-value pairs from asset
          tokenId: asset.id, // Map asset.id to tokenId
          owner: asset.uploader || "", // Assuming uploader is the owner
          type: asset.tier || "", // Assuming tier is the type
          supply: asset.supply || 0, // Ensure supply is set
          quantityOwned: "", // Placeholder (if needed later)
          pricePerToken: scaledPrice,
          currencyName: listing.currencyValuePerToken?.name || "",
          startTime: listing.startTimeInSeconds?.toString() || "",
          endTime: listing.endTimeInSeconds?.toString() || "",
          // imageByte: asset.image || "", // Assuming image is the imageByte equivalent
          listingId: listing.id, // Map listing.id correctly
          lister: "beats", // Default lister value
        };
      });
  
      return finalCardData;
    } catch (error) {
      console.error("Error fetching items:", error);
      throw error;
    }
  }
  
  


  public async getValidCardPacks(token: string): Promise<StorePackData[]> {
    try {
        const tokenService: TokenService = new TokenService();
        await tokenService.verifyAccessToken(token);

        const session: Session = this.driver.session();
        const result: QueryResult = await session.executeRead((tx: ManagedTransaction) =>
            tx.run(getValidCardPacks)
        );
        await session.close();

        const currentDate = new Date();
        const packs: StorePackData[] = result.records
            .map(record => record.get("c").properties)
            .filter(card => {
                const [month, day, year] = card.endTime.split('/');
                const endTime = new Date(`20${year}-${month}-${day}`);
                return endTime >= currentDate;
            });

        return packs as StorePackData[];
    } catch (error: any) {
        console.error("Error fetching items:", error);
        throw error
    }
  }


  // 
  public async buyCard(buycardData: BuyCardData, token: string) {
    try {
      const tokenService: TokenService = new TokenService();
      const username: string = await tokenService.verifyAccessToken(token);

      const { listingId, uri, price } = buycardData as BuyCardData

      const session: Session = this.driver.session();
      const result: QueryResult<RecordShape> = await session.executeRead((tx: ManagedTransaction) =>
        tx.run(buyCardCypher, { username }) 
      );
      await session.close();
      if (result.records.length === 0) {
        throw new ValidationError(`User with username '${username}' not found.`, '');
      }
      const userData: UserData = result.records[0].get("u");
      const { smartWalletAddress } = userData.properties;

      await this.cardPurchase(smartWalletAddress, listingId, price);

      return new SuccessMessage("Purchase was successful");
    } catch (error: any) {
      console.log(error)
      throw error
    }
  }


  //Initiates a card purchase using the provided wallet information and listing ID.
  private async cardPurchase(buyerWalletAddress: string, listingId: number, price: string) {
    try {
      const maxRetries = 3;
  
      // ✅ Retry mechanism for setting allowance
      let allowanceRetries = maxRetries;
      let allowanceTransaction;
      while (allowanceRetries > 0) {
        try {
          allowanceTransaction = await engine.erc20.setAllowance(CHAIN, BEATS_TOKEN, buyerWalletAddress, {
            spenderAddress: CARD_MARKETPLACE,
            amount: price,
          });
  
          // ✅ Ensure the allowance transaction is mined
          await this.ensureTransactionMined(allowanceTransaction.result.queueId);
          break; // Break if successful
        } catch (error: any) {
          console.error("Error setting allowance: ", error);
          allowanceRetries--;
          if (allowanceRetries === 0) {
            throw new Error("Failed to set allowance after multiple attempts.");
          }
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait before retrying
        }
      }
  
      const requestBody = {
        listingId: listingId.toString(),
        quantity: "1", // Default quantity for ERC721 tokens
        buyer: buyerWalletAddress,
      };
  
      // ✅ Retry mechanism for executing purchase
      let purchaseRetries = maxRetries;
      let transaction;
      while (purchaseRetries > 0) {
        try {
          transaction = (
            await engine.marketplaceDirectListings.buyFromListing(
              CHAIN,
              CARD_MARKETPLACE,
              buyerWalletAddress,
              requestBody
            )
          ).result;
  
          // ✅ Ensure the purchase transaction is mined
          await this.ensureTransactionMined(transaction.queueId);
          return transaction;
        } catch (error: any) {
          console.error("Error during card purchase attempt: ", error);
          purchaseRetries--;
          if (purchaseRetries === 0) {
            throw new Error("Failed to complete the card purchase after multiple attempts.");
          }
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait before retrying
        }
      }
    } catch (error: any) {
      console.error("Error during card purchase: ", error);
      throw new Error("Failed to complete the card purchase.");
    }
  }
  
  
  
  //Initiates a card pack purchase using the provided wallet information and listing ID.
  private async cardPackPurchase(buyerWalletAddress: string, listingId: number) {
    try {
      const contractAddress: string = PACK_MARKETPLACE;  // Assuming this is a constant or predefined variable

      // Constructing the request body
      const requestBody = {
          listingId: listingId.toString(), // Convert listingId to string
          quantity: "1", // Default quantity for ERC721 tokens
          buyer: buyerWalletAddress // The buyer's wallet address
      };
  
      // Call the buyFromListing function
      await engine.marketplaceDirectListings.buyFromListing(CHAIN, contractAddress, buyerWalletAddress, requestBody);

      return new SuccessMessage("Purchase was successful");
    } catch(error: any) {
      console.log(error)
      throw error
    }
    
  }


  
  public async buyCardPack(buycardData: BuyCardData, token: string): Promise<SuccessMessage> {
    try {
      const tokenService: TokenService = new TokenService();
      const username: string = await tokenService.verifyAccessToken(token);

      const { listingId, uri } = buycardData as BuyCardData;

      const session: Session = this.driver.session();
      const result: QueryResult = await session.executeRead(tx =>
        tx.run('MATCH (u:User {username: $username}) RETURN u', { username })
      );
      await session.close();
      if (result.records.length === 0) {
        throw new ValidationError(`User with username '${username}' not found.`, '');
      };
      
      const userData: UserData = result.records[0].get("u");
      const { smartWalletAddress } = userData.properties;

      await this.cardPackPurchase(smartWalletAddress, listingId);

      // // Create relationship using a separate Cypher query
      // await this.createCardPackRelationship(username, uri);

      return new SuccessMessage("Purchase was successful");
    } catch (error: any) {
      console.log(error)
      throw error
    }
  }
  


  public async getvalidCardUpgrade(token: string): Promise<StoreCardUpgradeData[]> {
    try {
      const tokenService: TokenService = new TokenService();
      await tokenService.verifyAccessToken(token);

      const session: Session = this.driver.session();
      const result: QueryResult = await session.executeRead((tx: ManagedTransaction) =>
          tx.run(getValidCardUpgrades)
      );
      await session.close();

      const cardUpgrade: StoreCardUpgradeData[] = result.records.map(record => record.get("c").properties);

      return cardUpgrade as StoreCardUpgradeData[];
    } catch (error: any) {
        console.error("Error fetching items:", error);
        throw error
    }
  }


	public async ensureTransactionMined(queueId: string): Promise<void> {
		const maxRetries = 15; // Number of immediate retries before background retry
		const maxErrorRetries = 5; // Max retries for errored transactions
		const retryInterval = 3000; // 3 seconds delay between retries
		const logEvery = 5; // Log every N retries
	
		let retries = 0;
		let errorRetries = 0;
		let lastStatus = "";
	
		while (retries < maxRetries) {
			try {
				const status = await engine.transaction.status(queueId);
	
				// ✅ Log status changes only
				if (status.result.status !== lastStatus) {
					console.log(`🔄 Transaction ${queueId} status: ${status.result.status}`);
					lastStatus = status.result.status;
				}
	
				if (status.result.status === "mined") {
					console.log(`✅ Transaction ${queueId} successfully mined.`);
					return;
				}
	
				if (status.result.status === "errored") {
					if (errorRetries >= maxErrorRetries) {
						console.error(`🚨 Transaction ${queueId} failed after ${maxErrorRetries} attempts.`);
						break; // Stop retries and move to background mode
					}
	
					console.warn(`⚠️ Transaction ${queueId} errored. Retrying... (${errorRetries + 1}/${maxErrorRetries})`);
					await engine.transaction.retryFailed({ queueId });
					await engine.transaction.syncRetry({ queueId }); // 🔄 Ensures retry is synchronous
					errorRetries++;
				}
	
				if (status.result.status === "cancelled") {
					console.error(`🚨 Transaction ${queueId} was cancelled.`);
					return;
				}
	
				// ✅ Log every N retries
				if (retries % logEvery === 0) {
					console.log(`⏳ Still waiting for transaction ${queueId} to be mined...`);
				}
	
				// Wait before checking status again
				await new Promise((resolve) => setTimeout(resolve, retryInterval));
			} catch (networkError) {
				console.warn(`⚠️ Network error while checking transaction ${queueId}, retrying...`, networkError);
			}
	
			retries++;
		}
	
		// 🚀 Start background retries after maxRetries is reached
		console.warn(`⚠️ Moving transaction ${queueId} to background monitoring...`);
		this.retryInBackground(queueId);
	}
	
	/**
	 * Retries a transaction in the background without blocking execution.
	 */
	private retryInBackground(queueId: string) {
		const retryInterval = 5000; // Retry every 5 seconds
		const maxBackgroundRetries = 100; // Give up after 100 background retries
	
		let retries = 0;
	
		const retryLoop = async () => {
			while (retries < maxBackgroundRetries) {
				try {
					const status = await engine.transaction.status(queueId);
	
					if (status.result.status === "mined") {
						console.log(`✅ (Background) Transaction ${queueId} successfully mined.`);
						return;
					}
	
					if (status.result.status === "errored") {
						console.warn(`⚠️ (Background) Retrying errored transaction ${queueId}... (${retries + 1}/${maxBackgroundRetries})`);
						await engine.transaction.retryFailed({ queueId });
						await engine.transaction.syncRetry({ queueId });
					}
	
					if (status.result.status === "cancelled") {
						console.error(`🚨 (Background) Transaction ${queueId} was cancelled.`);
						return;
					}
	
					// Wait before the next retry
					await new Promise((resolve) => setTimeout(resolve, retryInterval));
				} catch (networkError) {
					console.warn(`⚠️ (Background) Network error for transaction ${queueId}, retrying...`, networkError);
				}
	
				retries++;
			}
	
			console.error(`🚨 (Background) Transaction ${queueId} did not succeed after ${maxBackgroundRetries} retries.`);
		};
	
		// Run the retry loop in the background
		retryLoop();
	}
  
  







  }




