//** MEMGRAPH DRIVER AND TYPES
import { Driver, ManagedTransaction, QueryResult, RecordShape, Session } from "neo4j-driver";

//** IMPORTED SERVICES
import TokenService from "../../user.services/token.services/token.service";

//** TYPE INTERFACES
import { CardMetaData, InventoryCardData , InventoryCards, UpdateInventoryData } from "./inventory.interface";
import { checkInventorySizeCypher, openCardUpgradeCypher, unequipItemCypher } from "./inventory.cypher";
import { SuccessMessage } from "../../outputs/success.message";
import { StoreCardUpgradeData } from "../store.services/store.interface";
import WalletService, { engine } from "../../user.services/wallet.services/wallet.service";
import { CHAIN, EDITION_ADDRESS } from "../../config/constants";



class InventoryService {
driver?: Driver;
constructor(driver?: Driver) {
this.driver = driver;
    }

    
    //** CARD INVENTORY */
    // Retrieves inventory card data for a user based on the provided access token.
    public async cardInventoryOpen(token: string): Promise<InventoryCards> {
        try {
            const tokenService: TokenService = new TokenService();
            const userName: string = await tokenService.verifyAccessToken(token);
    
            const session: Session | undefined = this.driver?.session();
    
            const result: QueryResult | undefined = await session?.executeRead(tx =>
                tx.run(
                    'MATCH (u:User {username: $userName}) RETURN u.smartWalletAddress AS smartWalletAddress, u.equipped AS equipped',
                    { userName }
                )
            );
    
            await session?.close();
    
            // If no records found, return empty arrays
            if (!result || result.records.length === 0) {
                return [[], []];
            }
    
            const smartWalletAddress: string = result.records[0].get("smartWalletAddress");
            const equipped: string[] = result.records[0].get("equipped") || [];
    
            const ownedCards = (await engine.erc1155.getOwned(smartWalletAddress, CHAIN, EDITION_ADDRESS)).result;
    
            // Initialize arrays to store cards with different relationships
            const ownedAndInventory: InventoryCardData[] = [];
            const ownedAndEquipped: InventoryCardData[] = [];
    
            // Iterate over ownedCards and check against equipped
            ownedCards.forEach(card => {
                const tokenId: string = card.metadata.uri; // Assuming metadata.id is a string
    
                if (equipped.includes(tokenId)) {
                    ownedAndEquipped.push(card.metadata);
                } else {
                    ownedAndInventory.push(card.metadata);
                }
            });
    
            return [ownedAndInventory, ownedAndEquipped] as InventoryCards;
        } catch (error: any) {
            console.error("Error opening user inventory:", error);
            throw error;
        }
    }
    

    // Updates inventory data for a user based on the provided access token and update information.
    public async equipItem(token: string, updateInventoryData: UpdateInventoryData[]): Promise<SuccessMessage> {
        try {
            const walletService: WalletService = new WalletService();
            const tokenService: TokenService = new TokenService();
            const userName: string = await tokenService.verifyAccessToken(token);
    
            const smartWalletAddress: string = await walletService.getSmartWalletAddress(userName);
    
            // Iterate over each item in the updateInventoryData array
            for (const item of updateInventoryData) {
                const { group, contractAddress, tokenId, slot, uri } = item;
                const nftInventory = await this.getInventoryNFT(smartWalletAddress, contractAddress);
    
                // Check if the item is in inventory using the utility function
                //@ts-ignore
                const isInInventory = await this.isItemInInventory(nftInventory, tokenId, group, uri, slot);
    
                // If a match is not found, throw an error
                if (!isInInventory) {
                    throw new Error(`Item with tokenId ${tokenId}, group ${group}, and uri ${uri} is not in the inventory`);
                }
    
                await this.updateInventoryDB(group, userName, slot, {
                    uri,
                    tokenId,
                    contractAddress,
                    group,
                    slot,
                });

            }
    
            // Return success message
            return new SuccessMessage("Inventory update successful");
        } catch (error: any) {
            console.error("Error updating inventory:", error);
            throw error;
        }
    }


    // Utility function to check if an item is in the inventory
    private async isItemInInventory(
        nftInventory: Array<{ metadata: { id: string; group: string; uri: string, slot: string  } }>,
        tokenId: string,
        group: string,
        uri: string,
        slot: string ): Promise<boolean> {
        return nftInventory.some(
            (nft) =>
                nft.metadata.id === tokenId &&
                nft.metadata.group === group &&
                nft.metadata.uri === uri &&
                nft.metadata.slot === slot
        );
    }
    

    // Retrieves inventory card data for a user based on the provided access token.
    private async getInventoryNFT(username: string, contractAddress: string) {
        try {

            const nftInventory = await engine.erc1155.getOwned(username, CHAIN, contractAddress);
            return nftInventory.result;

        } catch(error: any) {
            console.error("Error retrieving NFT Inventory:", error);
            throw error;
        }
    }

    // Updates the inventory database with the provided update data.
    private async updateInventoryDB(groupName: string, username: string, slot: string, updateData: UpdateInventoryData): Promise<void> {
        try {
            const session: Session | undefined = this.driver?.session();
    
            // Fetch the inventory node for the group
            const result: QueryResult | undefined = await session?.executeWrite((tx: ManagedTransaction) =>
                tx.run(
                    `
                    MATCH (u:User {username: $username})-[:INVENTORY]->(i:${groupName})
                    RETURN i
                    `,
                    { username }
                )
            );
    
            if (!result || result.records.length === 0) {
                throw new Error(`Inventory for group ${groupName} not found for user ${username}`);
            }
    
            // Construct the Cypher query to update the specific slot dynamically
            const query = `
                MATCH (u:User {username: $username})-[:INVENTORY]->(i:${groupName})
                SET i.${slot} = $updateData
            `;
    
            // Execute the update query
            await session?.executeWrite((tx: ManagedTransaction) =>
                tx.run(query, {
                    username,
                    updateData,
                })
            );
    
            console.log(`Inventory for ${groupName} updated: ${slot} set successfully.`);
        } catch (error: any) {
            console.error("Error updating inventory in database:", error);
            throw error;
        } finally {
            const session: Session | undefined = this.driver?.session();
            await session?.close();
        }
    }
    



    // Retrieves inventory card data for a user based on the provided access token.
    public async upgradeInventoryOpen(token: string): Promise<StoreCardUpgradeData[]> {
      try {
        const tokenService: TokenService = new TokenService();
        const userName: string = await tokenService.verifyAccessToken(token);
    
        const session: Session | undefined = this.driver?.session();
    
        // Use a Read Transaction and only return the necessary properties
        const result: QueryResult<RecordShape> | undefined = await session?.executeRead(
          (tx: ManagedTransaction) =>
            tx.run(openCardUpgradeCypher, { userName })
        );
    
        await session?.close();
    
        // If no records found, return an empty array
        if (!result || result.records.length === 0) {
          return [];
        }
    
        // Extract card upgrade nodes from the result and return them in an array
        const cardUpgrades: StoreCardUpgradeData[]  = result.records.map((record: RecordShape) => record.get("cardUpgrade").properties);

        return cardUpgrades as StoreCardUpgradeData[];
      } catch (error: any) {
        console.error("Error opening user inventory:", error);
        throw error;
      }
    }
    
    // Updates inventory data for a user based on the provided access token and update information.
    public async unequipItem(token: string, updateInventoryData: UpdateInventoryData[]): Promise<SuccessMessage> {
      try {
          const tokenService: TokenService = new TokenService();
          const userName: string = await tokenService.verifyAccessToken(token);
  
          const session: Session | undefined = this.driver?.session();
  
          // Get the remaining inventory size
          const remainingSize: number | undefined = await this.checkInventorySize(userName);
  
          if (remainingSize === undefined) {
              throw new Error("Failed to retrieve remaining inventory size.");
          }
  
          // Calculate the number of items to be removed
          const itemsToRemove: number = updateInventoryData.length;
  
          // Check if the number of items to be removed exceeds the remaining inventory size
          if (itemsToRemove > remainingSize) {
              throw new Error("Insufficient inventory space to remove equipped items.");
          }

          // Iterate over each item in the updateInventoryData array
          for (const item of updateInventoryData) {
              const { uri } = item;
  
              // Use a Write Transaction to remove the equipped status of the item and reinstate it in the inventory
              const result: QueryResult<RecordShape> | undefined = await session?.executeWrite(
                  async (tx: ManagedTransaction) => {
                      return tx.run(unequipItemCypher, { userName, uri });
                  }
              );
          }
  
          await session?.close();
  
          // Return success message
          return new SuccessMessage("Equip removed");
      } catch (error: any) {
          console.error("Error removing equipped items:", error);
          throw error;
      }
    }

    // Check the remaining inventory size for a user based on the provided username.
    public async checkInventorySize(userName: string): Promise<number | undefined> {
      try {
          const session: Session | undefined = this.driver?.session();
  
          // Use a Read Transaction and only return the necessary properties
          const result: QueryResult<RecordShape> | undefined = await session?.executeRead(
              (tx: ManagedTransaction) =>
                  tx.run(checkInventorySizeCypher, {
                      userName
                  })
          );
  
          await session?.close();
  
          // If no records found, return undefined
          if (!result || result.records.length === 0) {
              return undefined;
          }
  
          // Extract the remaining inventory size from the result
          const remainingSize: number = result.records[0].get("remainingSize");
  
          return remainingSize as number
      } catch (error: any) {
          console.error("Error checking inventory size:", error);
          throw error;
      }
    }

    //
    public async packInventoryOpen(token: string) {
        try {
            const tokenService: TokenService = new TokenService();
            const userName: string = await tokenService.verifyAccessToken(token);
    
            const session: Session | undefined = this.driver?.session();
    
            // Use a Read Transaction and only return the necessary properties
            const result: QueryResult<RecordShape> | undefined = await session?.executeRead(
                (tx: ManagedTransaction) =>
                    tx.run(
                        `MATCH (u:User {username: $userName})-[:OWNED]->(p:Pack)
                         WHERE p.quantity > 0
                         RETURN p.name as name, p as packProperties`,
                        { userName }
                    )
            );
    
            await session?.close();
    
            // If no records found, return empty arrays
            if (!result || result.records.length === 0) {
                return [];
            }
    
            // Create an object to store card packs
            const cardPacks: { [uri: string]: Record<string, any> } = {};
    
            // Iterate over the result records
            result.records.forEach((record) => {
                const packUri: string | undefined = record.get("name");
                const packProperties: Record<string, any> = record.get("packProperties")?.properties;
    
                if (packUri && packProperties) {
                    // Extract the quantity if it exists
                    if (packProperties.quantity && typeof packProperties.quantity === 'object') {
                        packProperties.quantity = packProperties.quantity.toNumber();
                    }
    
                    cardPacks[packUri] = packProperties;
                }
            });
    
            // Return the card packs object inside an array
            return [cardPacks];
        } catch (error: any) {
            console.error("Error opening user inventory:", error);
            throw error;
        }
    }

    // Updates inventory data for a user based on the provided access token and update information.
    public async getChatItems(token: string): Promise<{ loudspeaker: { quantity: number } }> {
        let session: Session | undefined;
        try {
            const tokenService: TokenService = new TokenService();
            const username: string = await tokenService.verifyAccessToken(token);
    
            session = this.driver?.session();
            const result: QueryResult | undefined = await session?.executeRead((tx: ManagedTransaction) =>
                tx.run(
                    `
                    MATCH (u:User {username: $username})-[:OWNED]->(l:LoudSpeaker)
                    RETURN l.quantity as quantity
                    `,
                    { username }
                )
            );
    
            // Process the result and return the chat items
            if (!result || result.records.length === 0) {
                // Handle the case where no data is found
                return { loudspeaker: { quantity: 0 } };
            }
    
            // Extract the returned data from the records
            const quantity: number = result.records[0].get("quantity").toNumber();
            return { loudspeaker: { quantity } };
    
        } catch (error: any) {
            // Handle errors appropriately
            throw error;
        } finally {
            // Ensure the session is properly closed
            if (session) {
                await session.close();
            }
        }
    }
    
    
    public async openGroupCardEquipped(apiKey: string, groupName: string, username: string) {
        try {


            const tokenService: TokenService = new TokenService();
            const isAuthorized: boolean = await tokenService.verifyApiKey(apiKey);

            if (!isAuthorized) {
                return
            }
            
            const session: Session | undefined = this.driver?.session();
    
            const result: QueryResult | undefined = await session?.executeRead((tx: ManagedTransaction) =>
                tx.run(
                    `
                    MATCH (u:User {username: $username})-[:EQUIPPED]->(c:Card {group: $groupName})
                    RETURN c
                    `,
                    { username, groupName }
                )
            );


            // Process the result and extract the equipped cards
            const cards: CardMetaData[] = result?.records.map((record) => record.get('c').properties) || [];
            console.log(cards)
            // Close the session
            await session?.close();
    
            return cards;
            
        } catch (error: any) {
            console.error(error);
            throw error;
        }
    }
    
    
    





  }
  

export default InventoryService;