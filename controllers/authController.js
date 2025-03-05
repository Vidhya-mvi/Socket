const bcrypt = require("bcrypt");
const User = require("../models/user");
const OTP = require("../models/userVerification");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
require("dotenv").config();


let transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.log("Mail Transporter Error:", error);
  } else {
    console.log("Mail Transporter Ready");
  }
});


const sendOtpEmail = async (email, otp) => {
  console.log(`Sending OTP to ${email}: ${otp}`);

  const mailOption = {
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Email Verification OTP",
    html: `<p>Your OTP for email verification is <b>${otp}</b>. It is valid for 1 hour.</p>`,
  };

  try {
    await transporter.sendMail(mailOption);
    console.log(` OTP email sent successfully to ${email}`);
  } catch (error) {
    console.log(`Error sending OTP email to ${email}:`, error);
  }
};

// Register (Signup) 
exports.register = async (req, res) => {
  try {
    console.log("Register request body:", req.body);
    
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.render("register", { error: "All fields are required" });
    }

    if (!/^[a-zA-Z]*$/.test(name)) {
      return res.render("register", { error: "Invalid name entered" });
    }

    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      return res.render("register", { error: "Invalid email entered" });
    }

    if (password.length < 8) {
      return res.render("register", { error: "Password must be at least 8 characters" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("register", { error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      verified: false,
    });

    const otp = `${Math.floor(1000 + Math.random() * 9000)}`;
    console.log("Generated OTP:", otp);

    await OTP.create({
      userId: newUser._id,
      otp: otp,
      created_At: new Date(),
      expires_At: new Date(Date.now() + 3600000),
    });

    await sendOtpEmail(newUser.email, otp);

    return res.redirect(`/verify-email?userId=${newUser._id}`);
  } catch (error) {
    console.log("Error during registration:", error);
    return res.render("register", { error: error.message });
  }
};

// Login Route
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("login", { error: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.render("login", { error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("login", { error: "Invalid password" });
    }

    if (!user.verified) {
      return res.render("login", { error: "Please verify your email first" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, {
      expiresIn: "1h",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", 
      sameSite: "strict",
    });

    return res.redirect("/chat");
  } catch (err) {
    console.log("Login error:", err);
    return res.render("login", { error: "An error occurred during login" });
  }
};

// Email Verification 
exports.verifyEmail = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.render("verify-email", { error: "User ID and OTP are required" });
    }

    const otpRecord = await OTP.findOne({ userId, otp });

    if (!otpRecord) {
      return res.render("verify-email", { error: "Invalid OTP" });
    }

   
    if (new Date() > otpRecord.expires_At) {
      return res.render("verify-email", { error: "OTP has expired" });
    }

   
    const user = await User.findById(userId);
    user.verified = true;
    await user.save();

    return res.redirect("/login");
  } catch (error) {
    console.log("Error during email verification:", error);
    return res.render("verify-email", { error: "An error occurred during email verification" });
  }
};





 


 