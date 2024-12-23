import { mongoDBClient } from "./src/db/mongodb.client";

async function writeTestData() {
	try {
		// Connect to the client
		await mongoDBClient.connect();

		// Reference the 'beats' database and a 'testData' collection
		const database = mongoDBClient.db("beats");
		const collection = database.collection("testData");

		// Sample test data to insert
		const testData = {
			name: "Sample Beat",
			genre: "Hip-Hop",
			createdBy: "TestUser",
			createdAt: new Date(),
			duration: 180, // Duration in seconds
		};

		// Insert the test data
		const result = await collection.insertOne(testData);

		// Log the result
		console.log("Test data inserted successfully:", result.insertedId);
	} catch (error) {
		console.error("Error writing test data:", error);
	} finally {
		// Ensure the client is closed
		await mongoDBClient.close();
	}
}

// Run the function
writeTestData();
