const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  otp: {
    type: String,
    required: true
  },
  created_At: {
    type: Date,
    default: Date.now,
    required: true
  },
  expires_At: {
    type: Date,
    required: true,
  }
});

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;

