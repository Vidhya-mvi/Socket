const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: [3, "Group name must be at least 3 characters long"],
    maxlength: [100, "Group name can be at most 100 characters long"],
  },
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  ],
  groupAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
}, { timestamps: true }); // Timestamps already handle createdAt & updatedAt

// Custom validation: Ensure at least 3 participants (including admin)
groupSchema.pre("validate", function (next) {
  if (this.participants.length < 3) {
    return next(new Error("A group must have at least 3 participants"));
  }
  next();
});

// Middleware to keep updatedAt in sync
groupSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Middleware to prevent duplicates in participants
groupSchema.pre("save", function (next) {
  this.participants = [...new Set(this.participants.map(id => id.toString()))]; // Removes duplicates
  next();
});

const Group = mongoose.model("Group", groupSchema);

module.exports = Group;
