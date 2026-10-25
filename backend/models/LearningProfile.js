const mongoose = require("mongoose");

const learningProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    goals: {
      type: [String],
      enum: [
        "daily-conversation",
        "fluency",
        "grammar",
        "vocabulary",
        "job-interviews",
        "workplace-english",
        "exam-preparation",
      ],
      default: [],
    },
    preferredExplanationLanguage: {
      type: String,
      enum: ["English", "Hindi", "Hinglish"],
      default: "English",
    },
    startingLevel: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Beginner",
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LearningProfile", learningProfileSchema);
