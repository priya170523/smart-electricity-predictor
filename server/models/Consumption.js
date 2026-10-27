const mongoose = require("mongoose");

const consumptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    month: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    units: {
      type: Number,
      required: true,
      min: 0.001,
    },
    previousReading: {
      type: Number,
      required: true,
      min: 0,
    },
    currentReading: {
      type: Number,
      required: true,
      min: 0,
    },
    familyMembers: {
      type: Number,
      required: true,
      min: 1,
    },
    fans: {
      type: Number,
      required: true,
      min: 0,
    },
    airConditioners: {
      type: Number,
      required: true,
      min: 0,
    },
    refrigerators: {
      type: Number,
      required: true,
      min: 0,
    },
    otherAppliances: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

consumptionSchema.index({ user: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("Consumption", consumptionSchema);
