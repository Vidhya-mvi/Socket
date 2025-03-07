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
      return handleUnauthorized(req, res, "Authentication required.");
    }

    if (!process.env.SECRET_KEY) {
      console.error(" SECRET_KEY is missing in environment variables.");
      return res.status(500).json({ message: "Server configuration error" });
    }

    try {
      const verified = jwt.verify(token, process.env.SECRET_KEY);
      const user = await User.findById(verified.userId);

      if (!user) {
        console.warn(" User not found for provided token.");
        res.clearCookie("token");
        return handleUnauthorized(req, res, "User does not exist. Please log in again.");
      }

      req.user = user;
      next();
    } catch (err) {
      console.error(" Token verification failed:", err.message);

      if (err.name === "TokenExpiredError") {
        console.warn(" Token expired. Clearing token and redirecting.");
        res.clearCookie("token");
        return handleUnauthorized(req, res, "Session expired. Please log in again.");
      }

      return handleUnauthorized(req, res, "Invalid authentication token.");
    }
  } catch (err) {
    console.error(" Authentication Middleware Error:", err);
    return handleUnauthorized(req, res, "Authentication error. Please try again.");
  }
};


const handleUnauthorized = (req, res, message) => {
  if (req.headers.accept?.includes("application/json")) {
    return res.status(401).json({ error: message });
  }
  return res.redirect("/login");
};

const authRedirect = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

  if (token) {
      try {
          jwt.verify(token, process.env.SECRET_KEY);
          return res.redirect("/chat"); 
      } catch (err) {
          console.log("Invalid token, allowing access to login/register.");
      }
  }
  next();
};



module.exports = {authMiddleware,authRedirect};
