const mongoose = require("mongoose");

const scriptSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20000,
    },
  },
  { timestamps: true }
);

const teleprompterLibrarySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    scripts: {
      type: [scriptSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TeleprompterLibrary", teleprompterLibrarySchema);
