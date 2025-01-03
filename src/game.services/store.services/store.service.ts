//** THIRDWEB IMPORTS


//** MEMGRAPH IMPORTS
import { CARD_MARKETPLACE, EDITION_ADDRESS, PACK_MARKETPLACE } from "../../config/constants";
import { Driver, Session, ManagedTransaction, QueryResult, RecordShape } from "neo4j-driver-core";

//** CONFIG IMPORTs
import { CHAIN } from "../../config/constants";

//** VALIDATION IMPORT
import ValidationError from "../../outputs/validation.error";

//** SERVICE IMPORTS
import TokenService from "../../user.services/token.services/token.service";
import { BuyCardData, StoreCardData, StoreCardUpgradeData, StorePackData } from "./store.interface";
import { UserData } from "../../user.services/user.service.interface";

//** CYPHER IMPORTS
import { buyCardCypher, getValidCardPacks, getValidCardUpgrades, getValidCards } from "./store.cypher";

//** SUCCESS MESSAGE IMPORT
import { SuccessMessage } from "../../outputs/success.message";
import { engine } from "../../user.services/wallet.services/wallet.service";
import { CardNFT } from "../inventory.services/inventory.interface";



export default class StoreService {
  driver: Driver;
  constructor(driver: Driver) {
    this.driver = driver;
  }

  //Retrieves valid cards from the using the provided access token.
  public async getValidCards(token: string): Promise<StoreCardData[]> {
    try {
        const tokenService: TokenService = new TokenService();
        await tokenService.verifyAccessToken(token);

        const listed = (await engine.marketplaceDirectListings.getAllValid(CHAIN, CARD_MARKETPLACE)).result;
                    // Prepare the final array of card data
        let finalCardData: StoreCardData[] = [];

            // Iterate through listed tokenIds and fetch their metadata
            for (const listing of listed) {
              const tokenId: string = listing.tokenId;
  
              // Fetch metadata for the current tokenId
              const cardData = (await engine.erc1155.get(tokenId, CHAIN, EDITION_ADDRESS)).result as CardNFT;
  
              // Combine tokenId and spread the metadata and cardData into a single object
              const priceString = listing.pricePerToken;
              const scaledPrice = Number(BigInt(priceString) / BigInt(10 ** 18)); 
              
              const card: StoreCardData = {
                  ...cardData.metadata, // Spread metadata key-value pairs
                  tokenId, // Add tokenId
                  owner: cardData.owner, // Add owner property
                  type: cardData.type, // Add type property
                  supply: cardData.supply, // Add supply property
                  quantityOwned: cardData.quantityOwned || "" , // Add quantityOwned property
                  pricePerToken: scaledPrice, // Add pricePerToken property
                  currencyName: listing.currencyValuePerToken?.name || "", // Add currencyName property
                  startTime: listing.startTimeInSeconds?.toString() || "", // Add startTime property
                  endTime: listing.endTimeInSeconds?.toString() || "", // Add endTime property
                  imageByte: cardData.metadata.imageByte || "", // Add imageByte property
                  lister: "beats", // Add lister property with default value
              };
  
              // Push the combined object to the final array
              finalCardData.push(card);
          }

        return finalCardData as StoreCardData[];
    } catch (error: any) {
        console.error("Error fetching items:", error);
        throw error
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


  //Buys a card using the provided card data and access token.
  // public async buyCard(buycardData: BuyCardData, token: string): Promise<SuccessMessage> {
  //   try {
  //     const tokenService: TokenService = new TokenService();
  //     const username: string = await tokenService.verifyAccessToken(token);

  //     const { listingId, uri } = buycardData as BuyCardData

  //     const session: Session = this.driver.session();
  //     const result: QueryResult<RecordShape> = await session.executeRead((tx: ManagedTransaction) =>
  //       tx.run(buyCardCypher, { username }) 
  //     );
  //     await session.close();
  //     if (result.records.length === 0) {
  //       throw new ValidationError(`User with username '${username}' not found.`, '');
  //     }
  //     const userData: UserData = result.records[0].get("u");
  //     const { localWallet, localWalletKey } = userData.properties;

  //     await this.cardPurchase(localWallet, localWalletKey, listingId);

  //     // Decide the relationship type based on inventory and bag size
  //     const inventorySize: number = userData.properties.inventorySize.toNumber()
  //     const inventoryCurrentSize: number = result.records[0].get("inventoryCurrentSize").toNumber()

  //     // Create relationship using a separate Cypher query
  //     await this.createCardRelationship(username, uri, inventoryCurrentSize, inventorySize );

  //     return new SuccessMessage("Purchase was successful");
  //   } catch (error: any) {
  //     throw error
  //   }
  // }

  public async buyCard(buycardData: BuyCardData, token: string): Promise<SuccessMessage> {
    try {
      const tokenService: TokenService = new TokenService();
      const username: string = await tokenService.verifyAccessToken(token);

      const { listingId, uri } = buycardData as BuyCardData

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

      await this.cardPurchase(smartWalletAddress, listingId);

      // Decide the relationship type based on inventory and bag size
      const inventorySize: number = userData.properties.inventorySize.toNumber()
      const inventoryCurrentSize: number = result.records[0].get("inventoryCurrentSize").toNumber()

      // Create relationship using a separate Cypher query
      // await this.createCardRelationship(username, uri, inventoryCurrentSize, inventorySize );

      return new SuccessMessage("Purchase was successful");
    } catch (error: any) {
      throw error
    }
  }


  //Initiates a card purchase using the provided wallet information and listing ID.

  private async cardPurchase(buyerWalletAddress: string, listingId: number) {

    try {
      const contractAddress: string = CARD_MARKETPLACE; 

      // Constructing the request body
      const requestBody = {
          listingId: listingId.toString(), // Convert listingId to string
          quantity: "1", // Default quantity for ERC721 tokens
          buyer: buyerWalletAddress // The buyer's wallet address
      };
  
      // Call the buyFromListing function
      await engine.marketplaceDirectListings.buyFromListing(CHAIN, contractAddress, buyerWalletAddress, requestBody);

    } catch(error: any) {
      console.log(error);
      throw error;
    }

}

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
  

  //Creates a relationship between a user and a card based on provided parameters.
  // private async createCardRelationship(username: string, uri: string, inventoryCurrentSize: number, inventorySize: number): Promise<void> {
  //   try {

  //     // const rewardService: RewardService = new RewardService()
  //     // Determine the relationship type based on bag and inventory size
  //     let relationship: string[];
  //     if (inventorySize < inventoryCurrentSize + 1) {
  //       relationship = ["BAGGED"];
  //     } else {
  //       relationship = ["INVENTORY"];
  //     }
      
  //     // Get the card's name
  //     const session: Session = this.driver.session();
  //     for (const rel of relationship) {
  //       await session.run(`
  //         MATCH (u:User {username: $username}), (c:Card {uri: $uri})
  //         MATCH (c)-[l:LISTED]->(cs:CardStore)
  //         DELETE l
  //         CREATE (u)-[:${rel}]->(c)
  //         CREATE (c)-[:SOLD]->(cs)
  //       `, { username, uri });
  //     }
  //     await session.close();
  //   } catch (error: any) {
  //     console.error("Error creating relationship:", error);
  //     throw error;
  //   }
  // }
  

//   private async createCardPackRelationship(username: string, uri: string): Promise<void> {
//     const session: Session = this.driver.session();

//     try {
//         // Step 1: Get the parent pack's properties
//         const packNameResult = await session.run(`
//             MATCH (p:Pack {uri: $uri})
//             RETURN p.name AS name, p.quantity AS quantity, properties(p) AS props
//         `, { uri });

//         if (packNameResult.records.length === 0) {
//             throw new Error(`Pack with URI ${uri} not found`);
//         }

//         const parentPackName: string = packNameResult.records[0].get("name");
//         const parentPackProps: StorePackData = packNameResult.records[0].get("props");

//         // Remove the quantity property from the parent pack's properties
//         //@ts-ignore
//         delete parentPackProps.quantity;

//         // Step 2: Check if the user exists and already owns this pack
//         const userOwnsPack = await session.run(`
//             MATCH (u:User {username: $username})-[:OWNED]->(p:Pack {name: $name})
//             RETURN p AS pack
//         `, { username, name: parentPackName });

//         if (userOwnsPack.records.length > 0) {
//             // Update quantity of the owned pack
//             await session.run(`
//                 MATCH (u:User {username: $username})-[:OWNED]->(p:Pack {name: $name})
//                 SET p.quantity = p.quantity + 1
//             `, { username, name: parentPackName });

//             // Decrease quantity of the parent pack
//             await session.run(`
//                 MATCH (p:Pack {name: $name})
//                 WHERE p.child IS NULL OR p.child = false
//                 SET p.quantity = p.quantity - 1
//             `, { name: parentPackName });

//         } else {
//             // Step 3: Ensure the user exists before creating a new pack
//             const userExists = await session.run(`
//                 MATCH (u:User {username: $username})
//                 RETURN u
//             `, { username });

//             if (userExists.records.length === 0) {
//                 throw new Error(`User with username ${username} not found`);
//             }

//             // Create a new pack and associate it with the user
//             await session.run(`
//                 MATCH (u:User {username: $username})
//                 CREATE (u)-[:OWNED]->(newPack:Pack)
//                 SET newPack = $props, newPack.quantity = 1, newPack.child = true
//             `, { username, props: parentPackProps });

//             // Decrease quantity of the parent pack
//             await session.run(`
//                 MATCH (p:Pack {name: $name})
//                 WHERE p.child IS NULL OR p.child = false
//                 SET p.quantity = p.quantity - 1
//             `, { name: parentPackName });
//         }

//     } catch (error: any) {
//         console.error("Error creating relationship:", error);
//         throw error;
//     } finally {
//         await session.close();
//     }
// }


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


  // public async buyCardUpgrade(buyCardUpgradeData: BuyCardUpgradeData, token: string): Promise<SuccessMessage> {
  //   try {
  //     const tokenService: TokenService = new TokenService();
  //     const username: string = await tokenService.verifyAccessToken(token);
  
  //     const { listingId, quantity } = buyCardUpgradeData as BuyCardUpgradeData;
  
  //     const session: Session = this.driver.session();
  //     const result: QueryResult<RecordShape> = await session.executeRead((tx: ManagedTransaction) =>
  //       tx.run(buyCardUpgradeCypher, { username })
  //     );

  
  //     if (result.records.length === 0) {
  //       throw new ValidationError(`User with username '${username}' not found.`, '');
  //     }
  //     const userData: UserData = result.records[0].get("u");
  //     const { localWallet, localWalletKey } = userData.properties;
      
  //     await this.cardUpgradePurchase(localWallet, localWalletKey, listingId, quantity);
  //     await this.createCardUpgradeRelationship(username, listingId);
      
  //     return new SuccessMessage("Card Upgrade purchase successful")
  //   } catch(error: any) {
  //     return error;
  //   }
  // }
  

  // private async cardUpgradePurchase(localWallet: string, localWalletKey: string, listingId: number, quantity: string): Promise<void | Error> {
  //   try {
  //   const walletLocal: LocalWalletNode = new LocalWalletNode({ chain: CHAIN });
  //   await walletLocal.import({
  //     encryptedJson: localWallet,
  //     password: localWalletKey,
  //   });
  //   const smartWallet: SmartWallet = new SmartWallet(SMART_WALLET_CONFIG);
  //   await smartWallet.connect({
  //     personalWallet: walletLocal,
  //   });

  //   const sdk: ThirdwebSDK = await ThirdwebSDK.fromWallet(smartWallet, CHAIN);
  //   const contract: MarketplaceV3 = await sdk.getContract(CARD_UPGRADE_MARKETPLACE, "marketplace-v3");
  //   await contract.directListings.buyFromListing(listingId, quantity);




  // } catch(error: any) {
  //   console.log(error)
  //   return error
  //     }
  // }


  private async createCardUpgradeRelationship(username: string, listingId: number): Promise<void> {
  try {
    const session: Session = this.driver.session();

    await session.executeWrite((tx: ManagedTransaction) =>
      tx.run(`
        MATCH (u:User {username: "nashar4"}), (c:CardUpgrade {listingId: listingId}), (cu:CardUpgradeStore)
        MATCH (c)-[l:LISTED]->(cu)
        DELETE l
        CREATE (u)-[:OWNED]->(c)
        CREATE (c)-[:SOLD]->(cu)
      `, { username, listingId }) 
    );

    
  } catch (error: any) {
    console.error("Error creating relationship:", error);
    throw error;
  }
  }
  
}