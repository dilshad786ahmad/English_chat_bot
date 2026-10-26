const express = require("express");
const mongoose = require("mongoose");
const TeleprompterLibrary = require("../models/TeleprompterLibrary");

const router = express.Router();

const validateScript = (title, content) => (
  typeof title === "string" &&
  title.trim().length > 0 &&
  title.trim().length <= 100 &&
  typeof content === "string" &&
  content.trim().length > 0 &&
  content.length <= 20000
);

router.get("/scripts", async (req, res) => {
  try {
    const library = await TeleprompterLibrary.findOne({ userId: req.userId }).lean();
    return res.status(200).json({ success: true, scripts: library?.scripts || [] });
  } catch (error) {
    console.error("Teleprompter scripts fetch error:", error.message);
    return res.status(500).json({ success: false, message: "Could not load saved scripts." });
  }
});

router.post("/scripts", async (req, res) => {
  const { title, content } = req.body || {};
  if (!validateScript(title, content)) {
    return res.status(400).json({
      success: false,
      message: "A script title (up to 100 characters) and script (up to 20,000 characters) are required.",
    });
  }

  try {
    const library = await TeleprompterLibrary.findOneAndUpdate(
      { userId: req.userId },
      { $push: { scripts: { title: title.trim(), content: content.trim() } } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(201).json({ success: true, scripts: library.scripts });
  } catch (error) {
    console.error("Teleprompter script save error:", error.message);
    return res.status(500).json({ success: false, message: "Could not save this script." });
  }
});

router.put("/scripts/:scriptId", async (req, res) => {
  const { scriptId } = req.params;
  const { title, content } = req.body || {};
  if (!mongoose.isValidObjectId(scriptId)) {
    return res.status(400).json({ success: false, message: "Invalid script ID." });
  }
  if (!validateScript(title, content)) {
    return res.status(400).json({
      success: false,
      message: "A script title (up to 100 characters) and script (up to 20,000 characters) are required.",
    });
  }

  try {
    const library = await TeleprompterLibrary.findOneAndUpdate(
      { userId: req.userId, "scripts._id": scriptId },
      {
        $set: {
          "scripts.$.title": title.trim(),
          "scripts.$.content": content.trim(),
          "scripts.$.updatedAt": new Date(),
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!library) {
      return res.status(404).json({ success: false, message: "Saved script not found." });
    }
    return res.status(200).json({ success: true, scripts: library.scripts });
  } catch (error) {
    console.error("Teleprompter script update error:", error.message);
    return res.status(500).json({ success: false, message: "Could not update this script." });
  }
});

router.delete("/scripts/:scriptId", async (req, res) => {
  const { scriptId } = req.params;
  if (!mongoose.isValidObjectId(scriptId)) {
    return res.status(400).json({ success: false, message: "Invalid script ID." });
  }

  try {
    const library = await TeleprompterLibrary.findOneAndUpdate(
      { userId: req.userId, "scripts._id": scriptId },
      { $pull: { scripts: { _id: scriptId } } },
      { new: true }
    ).lean();

    if (!library) {
      return res.status(404).json({ success: false, message: "Saved script not found." });
    }
    return res.status(200).json({ success: true, scripts: library.scripts });
  } catch (error) {
    console.error("Teleprompter script delete error:", error.message);
    return res.status(500).json({ success: false, message: "Could not delete this script." });
  }
});

module.exports = router;
