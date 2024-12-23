import { MongoClient, ServerApiVersion } from "mongodb";
import { MONGO_HOST } from "../config/constants";

// Connection URI with environment variables
const uri = `mongodb://${process.env.MONGO_INITDB_ROOT_USERNAME}:${process.env.MONGO_INITDB_ROOT_PASSWORD}@${MONGO_HOST}`;
// const uri = "mongodb://localhost:27017";

console.log(uri )
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
export const mongoDBClient = new MongoClient(uri,  {
     serverApi: {
         version: ServerApiVersion.v1,
         strict: true,
         deprecationErrors: true,
     },
     tlsAllowInvalidCertificates: true, tls: true, timeoutMS: 20000, socketTimeoutMS: 20000
 }
);




// 


// async function run() {
// 	try {
// 		// Connect the client to the server (optional starting in v4.7)
// 		await mongoDBClient.connect();

// 		try {
// 			// Attempt to drop the collection
// 			await mongoDBClient.db("admin").createCollection("tite")
// 			console.log("Collection 'tite' dropped successfully.");
// 		} catch (dropError: any) {
// 			// Handle errors related to dropping the collection
// 			console.error("Error dropping collection:", dropError.message);
// 		}

// 		console.log("Pinged your deployment. You successfully connected to MongoDB!");
// 	} catch (connectError: any) {
// 		// Handle errors related to connecting to the database
// 		console.error("Error connecting to MongoDB:", connectError.message);
// 	} finally {
// 		// Ensure the client closes when finished or on error
// 		try {
// 			await mongoDBClient.close();
// 			console.log("MongoDB client closed.");
// 		} catch (closeError: any) {
// 			console.error("Error closing MongoDB client:", closeError.message);
// 		}
// 	}
// }

// // Run the function
// run().catch(console.dir);
