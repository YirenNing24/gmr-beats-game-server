//** MEMGRAPH DRIVER AND TYPES
import { Driver, ManagedTransaction, QueryResult, RecordShape, Session } from "neo4j-driver";

//** RETHINK DB
import rt from "rethinkdb";
import { getRethinkDB } from "../../db/rethink";

//** THIRDWEB IMPORTS
import { Edition, ThirdwebSDK } from "@thirdweb-dev/sdk";

//** VALIDATION ERROR
import ValidationError from "../../outputs/validation.error";

//** IMPORTED SERVICES
import TokenService from "../../user.services/token.services/token.service";

//** CONFIG IMPORT
import { SECRET_KEY, CHAIN, PRIVATE_KEY, EDITION_ADDRESS } from "../../config/constants";

//** CYPHER IMPORT
import { deductCardpack, openCardpackCypher } from "./gacha.cypher";

//** LUCKY ITEM IMPORT
import luckyItem from 'lucky-item'

//** TYPE INTERFACES
import { CardNameWeight, CardPackRate, PackData } from "./gacha.interface";



class GachaService {
    driver: Driver;
    constructor(driver: Driver) {
      this.driver = driver;
  }


  public async openCardPack(token: string, packData: PackData): Promise<string[]> {
      try {
          const tokenService: TokenService = new TokenService();
          const username: string = await tokenService.verifyAccessToken(token);
  
          // Assuming you know the pack name or ID key you want to work with
          const packName: string = Object.keys(packData)[0];

          const session: Session = this.driver.session();
          const result: QueryResult<RecordShape> = await session.executeRead((tx: ManagedTransaction) =>
              tx.run(openCardpackCypher, { username, name: packName })
          );

          if (!result || result.records.length === 0) {
              throw new ValidationError(`no data found`, "");
          }
  
          const pack: PackData = result.records[0].get("pack").properties;
          const walletAddress: string = result.records[0].get("walletAddress");
          
          const connection: rt.Connection = await getRethinkDB();
          const query: rt.Cursor = await rt.db('admin')
              .table('cardPacks')
              .filter({ packName: pack.name })
              .run(connection);
  
          const cardPack: CardPackRate[] = await query.toArray();
          const cardPackContent = cardPack[0];
  
          const { cardPackData } = cardPackContent;
          
          //@ts-ignore
          const rewardCards: string[] = await this.rollCardPack(cardPackData, walletAddress, username, pack.id);

           await session.executeRead((tx: ManagedTransaction) =>
             tx.run(deductCardpack, { username, name: packName })
         );

        return rewardCards;
      } catch (error: any) {
          console.log(error);
          throw error;
      }
  }
  

  private async rollCardPack(cardNameWeight: CardNameWeight[], walletAddress: string, username: string, packId: string): Promise<string[]> {
    try {
        // Use luckyItem to get the weighted items
        const cardCount: number = cardNameWeight.length;
        const weightedItems: CardNameWeight[] = luckyItem.itemsBy(cardNameWeight, 'weight', cardCount);
        
        // Extract the card names from the weighted items
        const cardNames: string[] = weightedItems.map(item => item.cardName);

        // Transfer the reward cards
        await this.transferRewardCards(cardNames, walletAddress, username, packId);


        return cardNames;
    } catch (error: any) {
        console.error(error);
        throw error;
    }
  }


  private async transferRewardCards(rewardCards: string[], walletAddress: string, username: string, packId: string): Promise<void> {
    const session: Session = this.driver.session();
    try {
        // Initialize the ThirdwebSDK with your private key and chain
        const sdk: ThirdwebSDK = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, CHAIN, {
            secretKey: SECRET_KEY,
        });

        const cardContract: Edition = await sdk.getContract(EDITION_ADDRESS, 'edition');

        const cardIDs: Array<string> = [];
        const cardNames: Array<string> = [];
        const amounts: Array<number> = [];

        for (const cardName of rewardCards) {
            // Cypher query to find one card for each name in rewardCards
            const query = `
                MATCH (c:Card)
                WHERE c.name = $cardName 
                AND (c.transferred = false OR c.transferred IS NULL)
                RETURN c
                LIMIT 1
            `;

            // Execute the query and retrieve the matching card
            const result: QueryResult<RecordShape> = await session.executeRead((tx: ManagedTransaction) =>
                tx.run(query, { cardName })
            );

            if (result.records.length === 0) {
                console.log(`No valid card found for: ${cardName}`);
                continue;
            }

            const record = result.records[0];
            const card = record.get('c').properties;
            const { id, name } = card;
            if (id) {
                cardIDs.push(id);
                cardNames.push(name);
                amounts.push(1); // Add 1 to the amounts array for each card

                // Set transferred = true in the database first
                const updateQuery = `
                    MATCH (c:Card {id: $id})
                    SET c.transferred = true
                `;
                await session.run(updateQuery, { id });
            }
        }

        if (cardIDs.length > 0) {
            // Use transferBatch with the amounts array
            await cardContract.transferBatch(walletAddress, cardIDs, amounts);

            // Update inventory and burn pack if cards were transferred
            await this.updateInventory(username, cardNames, cardIDs);
            await cardContract.burn(packId, 1);
        } else {
            console.log('No valid cards were found to transfer.');
        }

    } catch (error: any) {
        console.error(error);
        throw error;
    } finally {
        await session.close();
    }
  }


  private async updateInventory(username: string, cardNames: string[], tokenIds: string[]): Promise<void> {
    const session: Session = this.driver.session();
    try {
        // Query to get the user's current inventory size
        const query = `
            MATCH (u:User {username: $username})-[:INVENTORY]->(c:Card)
            RETURN u, COUNT(c) AS inventoryCurrentSize
        `;

        // Execute the query to get the user and inventory size
        const result: QueryResult<RecordShape> = await session.executeRead((tx: ManagedTransaction) =>
            tx.run(query, { username })
        );

        // Check if the query returned results
        if (!result || result.records.length === 0) {
            // If no records are returned, set inventorySize and inventoryCurrentSize to 0
            const inventorySize = 0;
            const inventoryCurrentSize = 0;
            
            // Proceed to create the card relationships
            await this.createCardRelationship(session, username, cardNames, tokenIds, inventoryCurrentSize, inventorySize);
            return;
        }

        // Extract user data and inventoryCurrentSize from the result
        const userData = result.records[0].get("u");
        const inventorySize: number = userData.properties.inventorySize.toNumber();
        const inventoryCurrentSize: number = result.records[0].get("inventoryCurrentSize").toNumber();

        // Proceed to create the card relationships
        await this.createCardRelationship(session, username, cardNames, tokenIds, inventoryCurrentSize, inventorySize);

    } catch (error: any) {
        console.error(error);
        throw error;
    } finally {
        await session.close();
    }
  }


  private async createCardRelationship(session: Session, username: string, cardNames: string[], tokenIds: string[], inventoryCurrentSize: number, inventorySize: number): Promise<void> {
        try {
            // Prepare the data for the query
            const cards = cardNames.map((name, i) => ({
                name,
                tokenId: tokenIds[i]
            }));

            // Variable to keep track of available inventory space
            let remainingInventorySlots = inventorySize - inventoryCurrentSize;

            // Iterate over the cards and assign the correct relationship based on remaining slots
            for (let i = 0; i < cards.length; i++) {
                const relationship = remainingInventorySlots > 0 ? "INVENTORY" : "BAGGED";

                // Generate the Cypher query for each card
                const query = `
                    MATCH (u:User {username: $username}), (c:Card {name: $cardName, id: $tokenId})
                    SET c.transferred = true
                    CREATE (u)-[:${relationship}]->(c)
                `;

                // Execute the query for each card
                await session.run(query, {
                    username,
                    cardName: cards[i].name,
                    tokenId: cards[i].tokenId
                });

                // Decrement remaining inventory slots if the card was added to INVENTORY
                if (remainingInventorySlots > 0) {
                    remainingInventorySlots--;
                }
            }

        } catch (error: any) {
            console.error("Error creating relationship:", error);
            throw error;
        }
  }


}

export default GachaService