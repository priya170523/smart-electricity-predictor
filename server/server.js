const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs/promises");
const { execFile } = require("child_process");
const { promisify } = require("util");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("./models/User");
const Consumption = require("./models/Consumption");
const requireAuth = require("./middleware/auth");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 5001;
const execFileAsync = promisify(execFile);

const PROJECT_ROOT = path.resolve(__dirname, "..");

const PYTHON_PATH = path.join(
  PROJECT_ROOT,
  "ml",
  "venv",
  "bin",
  "python"
);

const ML_SCRIPT_PATH = path.join(
  PROJECT_ROOT,
  "ml",
  "train_model.py"
);

const KAGGLE_INFO_SCRIPT = path.join(
  PROJECT_ROOT,
  "ml",
  "kaggle_model_info.py"
);

const KAGGLE_FORECAST_SCRIPT = path.join(
  PROJECT_ROOT,
  "ml",
  "kaggle_forecast.py"
);

const ELECTRICITY_RATE = 5;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ============================================
// HELPER: CREATE JWT
// ============================================

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from server/.env");
  }

  return jwt.sign(
    {
      userId: user._id.toString(),
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

// ============================================
// HOME ROUTE
// ============================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Smart Electricity Predictor API is running",
  });
});

// ============================================
// HEALTH CHECK
// GET /api/health
// ============================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    server: "running",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
  });
});

// ============================================
// USER REGISTRATION
// POST /api/register
// ============================================

app.post("/api/register", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: "Database is not connected",
      });
    }

    const { name, email, password } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2 || cleanName.length > 80) {
      return res.status(400).json({
        success: false,
        message: "Name must contain between 2 and 80 characters",
      });
    }

    if (
      cleanEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must contain between 8 and 72 characters",
      });
    }

    const existingUser = await User.findOne({
      email: cleanEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists. Please log in.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
    });

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
});

// ============================================
// USER LOGIN
// POST /api/login
// ============================================

app.post("/api/login", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: "Database is not connected",
      });
    }

    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: cleanEmail,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = createToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
});

// ============================================
// GET ALL CONSUMPTION RECORDS
// GET /api/consumption
// ============================================

app.get("/api/consumption", requireAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: "Database is not connected",
      });
    }

    const records = await Consumption.collection
      .find({
        user: new mongoose.Types.ObjectId(req.userId),
      })
      .sort({ month: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error("Error fetching consumption records:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch consumption records",
    });
  }
});

// ============================================
// ADD A CONSUMPTION RECORD
// POST /api/consumption
// ============================================

app.post("/api/consumption", requireAuth, async (req, res) => {
  try {
    const {
      month,
      previousReading,
      currentReading,
      units,
      familyMembers,
      fans,
      airConditioners,
      refrigerators,
      otherAppliances,
    } = req.body || {};

    const requiredFields = {
      month,
      previousReading,
      currentReading,
      units,
      familyMembers,
      fans,
      airConditioners,
      refrigerators,
      otherAppliances,
    };

    for (const [field, value] of Object.entries(requiredFields)) {
      if (value === undefined || value === null || value === "") {
        return res.status(400).json({
          success: false,
          message: `${field} is required`,
        });
      }
    }

    if (
      typeof month !== "string" ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ) {
      return res.status(400).json({
        success: false,
        message: "Month must use YYYY-MM format",
      });
    }

    const numericFields = {
      previousReading,
      currentReading,
      units,
      familyMembers,
      fans,
      airConditioners,
      refrigerators,
      otherAppliances,
    };

    const values = {};

    for (const [field, value] of Object.entries(numericFields)) {
      const number = Number(value);

      if (!Number.isFinite(number)) {
        return res.status(400).json({
          success: false,
          message: `${field} must be a valid number`,
        });
      }

      values[field] = number;
    }

    if (values.previousReading < 0 || values.currentReading < 0) {
      return res.status(400).json({
        success: false,
        message: "Meter readings cannot be negative",
      });
    }

    if (values.currentReading < values.previousReading) {
      return res.status(400).json({
        success: false,
        message:
          "Current reading cannot be less than previous reading",
      });
    }

    const calculatedUnits =
      values.currentReading - values.previousReading;

    if (Math.abs(calculatedUnits - values.units) > 0.01) {
      return res.status(400).json({
        success: false,
        message:
          "Units consumed must equal current reading minus previous reading",
        calculatedUnits,
      });
    }

    if (values.units <= 0) {
      return res.status(400).json({
        success: false,
        message: "Units consumed must be greater than zero",
      });
    }

    if (
      !Number.isInteger(values.familyMembers) ||
      values.familyMembers < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Family members must be a positive whole number",
      });
    }

    const applianceFields = [
      "fans",
      "airConditioners",
      "refrigerators",
      "otherAppliances",
    ];

    for (const field of applianceFields) {
      if (!Number.isInteger(values[field]) || values[field] < 0) {
        return res.status(400).json({
          success: false,
          message: `${field} must be a non-negative whole number`,
        });
      }
    }

    const userId = new mongoose.Types.ObjectId(req.userId);

    const existingRecord = await Consumption.collection.findOne({
      user: userId,
      month,
    });

    if (existingRecord) {
      return res.status(409).json({
        success: false,
        message: `A consumption record already exists for ${month}`,
      });
    }

    const record = await Consumption.create({
      user: userId,
      month,
      previousReading: values.previousReading,
      currentReading: values.currentReading,
      units: values.units,
      familyMembers: values.familyMembers,
      fans: values.fans,
      airConditioners: values.airConditioners,
      refrigerators: values.refrigerators,
      otherAppliances: values.otherAppliances,
    });

    return res.status(201).json({
      success: true,
      message: "Electricity consumption record saved successfully",
      data: record,
    });
  } catch (error) {
    console.error("Error saving consumption:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A record already exists for this month",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to save electricity consumption record",
    });
  }
});

// ============================================
// DELETE A CONSUMPTION RECORD
// DELETE /api/consumption/:id
// ============================================

app.delete("/api/consumption/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid consumption record ID",
      });
    }

    const deletedRecord =
      await Consumption.collection.findOneAndDelete({
        _id: new mongoose.Types.ObjectId(id),
        user: new mongoose.Types.ObjectId(req.userId),
      });

    if (!deletedRecord) {
      return res.status(404).json({
        success: false,
        message: "Consumption record not found for this user",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Consumption record for ${deletedRecord.month} deleted successfully`,
      data: deletedRecord,
    });
  } catch (error) {
    console.error("Error deleting consumption:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete consumption record",
    });
  }
});

// ============================================
// KAGGLE 24-HOUR FORECAST
// GET /api/kaggle-forecast
// ============================================

app.get("/api/kaggle-forecast", requireAuth, async (req, res) => {
  try {
    const { stdout, stderr } = await execFileAsync(
      PYTHON_PATH,
      ["-u", KAGGLE_FORECAST_SCRIPT],
      {
        cwd: PROJECT_ROOT,
        timeout: 60000,
        maxBuffer: 1024 * 1024,
      }
    );

    if (stderr && stderr.trim()) {
      console.warn("Kaggle forecast warnings:", stderr.trim());
    }

    let forecast;

    try {
      forecast = JSON.parse(stdout.trim());
    } catch (parseError) {
      console.error("Could not parse Kaggle forecast output:", parseError);

      return res.status(500).json({
        success: false,
        message: "The Kaggle forecast script returned invalid JSON.",
      });
    }

    if (!forecast.success) {
      return res.status(500).json({
        success: false,
        message:
          forecast.message || "Could not generate the Kaggle forecast.",
      });
    }

    return res.status(200).json(forecast);
  } catch (error) {
    console.error(
      "Kaggle forecast API error:",
      error.stderr
        ? error.stderr.toString().slice(0, 1000)
        : error.message
    );

    if (error.code === "ETIMEDOUT") {
      return res.status(504).json({
        success: false,
        message: "Generating the Kaggle forecast timed out.",
      });
    }

    if (error.code === "ENOENT") {
      return res.status(500).json({
        success: false,
        message: "Python or the Kaggle forecast script could not be found.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to run the Kaggle forecast model.",
      details: error.stderr
        ? error.stderr.toString().slice(0, 1000)
        : error.message,
    });
  }
});

// ============================================
// KAGGLE MODEL INFORMATION API
// GET /api/kaggle-model-info
// ============================================

app.get("/api/kaggle-model-info", requireAuth, async (req, res) => {
  try {
    const { stdout, stderr } = await execFileAsync(
      PYTHON_PATH,
      ["-u", KAGGLE_INFO_SCRIPT],
      {
        cwd: PROJECT_ROOT,
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      }
    );

    if (stderr && stderr.trim()) {
      console.log("Kaggle model information:", stderr.trim());
    }

    let result;

    try {
      result = JSON.parse(stdout.trim());
    } catch (parseError) {
      console.error(
        "Could not parse Kaggle model information:",
        parseError
      );

      return res.status(500).json({
        success: false,
        message:
          "The Kaggle model information script returned invalid JSON.",
      });
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Unable to load Kaggle model information.",
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Kaggle model API error:", error);

    if (error.code === "ETIMEDOUT") {
      return res.status(504).json({
        success: false,
        message: "Loading Kaggle model information timed out.",
      });
    }

    if (error.code === "ENOENT") {
      return res.status(500).json({
        success: false,
        message:
          "Python or the Kaggle model information script could not be found.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to load Kaggle model information.",
      details: error.stderr
        ? error.stderr.toString().slice(0, 1000)
        : error.message,
    });
  }
});

// ============================================
// EXISTING PERSONALIZED ELECTRICITY PREDICTION
// GET /api/prediction
// ============================================

app.get("/api/prediction", requireAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: "Database is not connected",
      });
    }

    const records = await Consumption.collection
      .find({
        user: new mongoose.Types.ObjectId(req.userId),
      })
      .sort({ month: 1 })
      .toArray();

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Add consumption records to generate a prediction.",
      });
    }

    const latestRecord = records[records.length - 1];
    const recentRecords = records.slice(-6);

    const averageUnits =
      recentRecords.reduce(
        (sum, record) => sum + Number(record.units || 0),
        0
      ) / recentRecords.length;

    const predictedConsumption = Number(averageUnits.toFixed(2));
    const estimatedBill = Number(
      (predictedConsumption * ELECTRICITY_RATE).toFixed(2)
    );

    return res.status(200).json({
      success: true,
      model: "Recent Consumption Average",
      predictedConsumption,
      estimatedBill,
      electricityRate: ELECTRICITY_RATE,
      unit: "kWh",
      currency: "INR",
      basedOnRecords: recentRecords.length,
      latestMonth: latestRecord.month,
      note:
        "This is a simple estimate based on your recent recorded consumption, not a trained personalized ML forecast.",
    });
  } catch (error) {
    console.error("Personalized prediction error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not generate the personalized prediction.",
    });
  }
});

// ============================================
// HANDLE UNKNOWN ROUTES
// ============================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "API route not found",
    path: req.originalUrl,
  });
});

// ============================================
// START SERVER AND CONNECT TO MONGODB
// ============================================

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing. Check server/.env");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing. Check server/.env");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB Connected");
    console.log("Database:", mongoose.connection.name);

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();