const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

const Consumption = require("../server/models/Consumption");

// Load MongoDB configuration from server/.env
dotenv.config({
  path: path.join(__dirname, "../server/.env"),
});

// 40 sample readings from July 2023 through October 2026.
// These are synthetic testing values, not actual household measurements.
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

// Sample household and appliance details.
const APPLIANCES = {
  familyMembers: 4,
  fans: 4,
  airConditioners: 1,
  refrigerators: 1,
  otherAppliances: 5,
};

async function seedConsumption() {
  let exitCode = 0;

  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error(
        "MONGODB_URI is missing. Check server/.env."
      );
    }

    console.log("Connecting to MongoDB...");

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });

    console.log("MongoDB connection established.");
    console.log("Database:", mongoose.connection.name);
    console.log("MongoDB host:", mongoose.connection.host);

    // Verify that MongoDB responds to a ping.
    await mongoose.connection.db.admin().ping();

    console.log("MongoDB ping successful.");

    // Verify the sample data contains exactly 40 unique months.
    if (readings.length !== 40) {
      throw new Error(
        `Expected 40 readings, but found ${readings.length}.`
      );
    }

    const months = readings.map(([month]) => month);

    if (new Set(months).size !== months.length) {
      throw new Error(
        "The sample dataset contains duplicate months."
      );
    }

    // Retrieve existing records for these 40 months.
    const existingRecords = await Consumption.find(
      { month: { $in: months } },
      { month: 1, _id: 0 }
    ).lean();

    const existingMonths = new Set(
      existingRecords.map((record) => record.month)
    );

    // Prepare records only for months that do not exist.
    const recordsToInsert = readings
      .filter(([month]) => !existingMonths.has(month))
      .map(([month, previousReading, currentReading]) => {
        const units = currentReading - previousReading;

        if (
          !Number.isFinite(units) ||
          units <= 0 ||
          currentReading < previousReading
        ) {
          throw new Error(
            `Invalid meter readings for ${month}.`
          );
        }

        return {
          month,
          previousReading,
          currentReading,
          units,
          ...APPLIANCES,
        };
      });

    const skippedCount =
      readings.length - recordsToInsert.length;

    console.log("\nInsertion summary");
    console.log("-----------------");
    console.log("Total sample readings:", readings.length);
    console.log("Already-existing months:", skippedCount);
    console.log("New records to insert:", recordsToInsert.length);

    if (recordsToInsert.length > 0) {
      // Insert all new records in one bulk operation.
      // ordered: true stops on the first insertion error.
      const insertedRecords = await Consumption.insertMany(
        recordsToInsert,
        { ordered: true }
      );

      console.log(
        "\nSuccessfully inserted:",
        insertedRecords.length
      );

      insertedRecords
        .sort((a, b) => a.month.localeCompare(b.month))
        .forEach((record) => {
          console.log(
            `${record.month}: ${record.units} kWh`
          );
        });
    } else {
      console.log(
        "\nAll 40 sample months already exist. Nothing was inserted."
      );
    }

    const totalRecords =
      await Consumption.countDocuments();

    console.log(
      "\nTotal records in the database:",
      totalRecords
    );

    console.log("Bulk insertion process completed.");
  } catch (error) {
    exitCode = 1;

    console.error("\nBulk insertion failed.");
    console.error("Error:", error.message);

    if (
      error.name === "MongooseServerSelectionError" ||
      error.name === "MongoServerSelectionError"
    ) {
      console.error(
        "MongoDB could not be reached. Check the connection string, network access, and MongoDB Atlas cluster status."
      );
    }

    if (error.code === 11000) {
      console.error(
        "A duplicate month was detected. Existing records were not intentionally overwritten."
      );
    }
  } finally {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log("MongoDB connection closed.");
      }
    } catch (disconnectError) {
      console.error(
        "Error closing MongoDB connection:",
        disconnectError.message
      );

      exitCode = 1;
    }

    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  }
}

seedConsumption();

