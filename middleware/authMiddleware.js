const jwt = require("jsonwebtoken");
const User = require("../models/user");
require("dotenv").config();

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      req.cookies?.token ||
      (authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null) ||
      req.body.token;

    if (!token) {
      console.warn("No authentication token found.");
      return res.redirect("/login"); // Redirect to login if no token
    }

    if (!process.env.SECRET_KEY) {
      console.error("SECRET_KEY is missing in environment variables.");
      return res.status(500).json({ message: "Server configuration error" });
    }

    try {
      const verified = jwt.verify(token, process.env.SECRET_KEY);
      const user = await User.findById(verified.userId);

      if (!user) {
        console.warn("User not found for token.");
        res.clearCookie("token");
        return res.redirect("/login");
      }

      req.user = user;
      next();
    } catch (err) {
      console.error("Token verification failed:", err.message);

      if (err.name === "TokenExpiredError") {
        console.warn("Token expired. Redirecting to login.");
        res.clearCookie("token");
      }

      return res.redirect("/login"); // Redirect if token is expired/invalid
    }
  } catch (err) {
    console.error("Authentication Middleware Error:", err);
    return res.redirect("/login");
  }
};

module.exports = authMiddleware;
