const express = require("express");
const LearningProfile = require("../models/LearningProfile");

const router = express.Router();
const allowedGoals = new Set([
  "daily-conversation",
  "fluency",
  "grammar",
  "vocabulary",
  "job-interviews",
  "workplace-english",
  "exam-preparation",
]);
const allowedLanguages = new Set(["English", "Hindi", "Hinglish"]);
const allowedLevels = new Set(["Beginner", "Intermediate", "Advanced"]);

router.get("/profile", async (req, res) => {
  try {
    const profile = await LearningProfile.findOne({ userId: req.userId }).lean();
    return res.status(200).json({ success: true, profile });
  } catch (error) {
    console.error("Learning profile fetch error:", error.message);
    return res.status(500).json({ success: false, message: "Could not load learning profile." });
  }
});

router.put("/profile", async (req, res) => {
  const { goals, preferredExplanationLanguage, startingLevel } = req.body || {};

  if (
    !Array.isArray(goals) ||
    goals.length < 1 ||
    goals.length > 3 ||
    goals.some((goal) => typeof goal !== "string" || !allowedGoals.has(goal)) ||
    new Set(goals).size !== goals.length ||
    !allowedLanguages.has(preferredExplanationLanguage) ||
    !allowedLevels.has(startingLevel)
  ) {
    return res.status(400).json({
      success: false,
      message: "Choose 1–3 valid learning goals, an explanation language, and a starting level.",
    });
  }

  try {
    const profile = await LearningProfile.findOneAndUpdate(
      { userId: req.userId },
      {
        $set: {
          goals,
          preferredExplanationLanguage,
          startingLevel,
          onboardingCompleted: true,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({ success: true, profile });
  } catch (error) {
    console.error("Learning profile update error:", error.message);
    return res.status(500).json({ success: false, message: "Could not save learning profile." });
  }
});

module.exports = router;
