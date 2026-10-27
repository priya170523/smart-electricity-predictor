const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

// Load the same environment configuration used by the backend.
dotenv.config({ path: path.join(__dirname, ".env") });

// Load the model from the server folder.
const Consumption = require("./models/Consumption");

const readings = [
  ["2023-07", 1000, 1120],
  ["2023-08", 1120, 1250],
  ["2023-09", 1250, 1365],
  ["2023-10", 1365, 1460],
  ["2023-11", 1460, 1545],
  ["2023-12", 1545, 1645],
  ["2024-01", 1645, 1755],
  ["2024-02", 1755, 1850],
  ["2024-03", 1850, 1970],
  ["2024-04", 1970, 2110],
  ["2024-05", 2110, 2275],
  ["2024-06", 2275, 2465],
  ["2024-07", 2465, 2665],
  ["2024-08", 2665, 2855],
  ["2024-09", 2855, 3025],
  ["2024-10", 3025, 3165],
  ["2024-11", 3165, 3275],
  ["2024-12", 3275, 3400],
  ["2025-01", 3400, 3530],
  ["2025-02", 3530, 3645],
  ["2025-03", 3645, 3795],
  ["2025-04", 3795, 3975],
  ["2025-05", 3975, 4195],
  ["2025-06", 4195, 4445],
  ["2025-07", 4445, 4695],
  ["2025-08", 4695, 4925],
  ["2025-09", 4925, 5125],
  ["2025-10", 5125, 5295],
  ["2025-11", 5295, 5435],
  ["2025-12", 5435, 5585],
  ["2026-01", 5585, 5740],
  ["2026-02", 5740, 5875],
  ["2026-03", 5875, 6065],
  ["2026-04", 6065, 6295],
  ["2026-05", 6295, 6575],
  ["2026-06", 6575, 6875],
  ["2026-07", 6875, 7160],
  ["2026-08", 7160, 7390],
  ["2026-09", 7390, 7590],
  ["2026-10", 7590, 7780],
];

async function seedConsumption() {
  try {
    console.log("Connecting to MongoDB...");

    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is missing. Check your server/.env file."
      );
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully.");
    console.log("Database:", mongoose.connection.name);
    console.log("MongoDB host:", mongoose.connection.host);

    await mongoose.connection.db.admin().ping();
    console.log("MongoDB ping successful.");

    // Convert the readings into documents matching the Consumption schema.
    const operations = readings.map(([month, previousReading, currentReading]) => {
      const units = currentReading - previousReading;

      const document = {
        month,
        previousReading,
        currentReading,
        units,
        familyMembers: 4,
        fans: 4,
        airConditioners: 1,
        refrigerators: 1,
        otherAppliances: 5,
      };

      return {
        updateOne: {
          filter: { month },
          update: { $set: document },
          upsert: true,
        },
      };
    });

    console.log("Inserting or updating 40 monthly readings...");

    // Upsert avoids creating duplicate records for existing months.
    const result = await Consumption.bulkWrite(operations, {
      ordered: true,
    });

    const totalRecords = await Consumption.countDocuments();

    console.log("\nSeed operation completed successfully!");
    console.log("New records inserted:", result.upsertedCount);
    console.log("Existing records updated:", result.modifiedCount);
    console.log("Total records in database:", totalRecords);

    const savedRecords = await Consumption.find()
      .sort({ month: 1 })
      .select("month previousReading currentReading units -_id")
      .lean();

    console.log("\nSaved monthly readings:");

    savedRecords.forEach((record) => {
      console.log(
        `${record.month}: Previous=${record.previousReading}, ` +
          `Current=${record.currentReading}, Units=${record.units}`
      );
    });
  } catch (error) {
    console.error("\nBulk insertion failed.");
    console.error("Error:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log("\nMongoDB connection closed.");
    }
  }
}

seedConsumption();
