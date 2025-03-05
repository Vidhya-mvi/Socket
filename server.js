const express = require("express");
const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoute"); // Ensure the filename is correct
const http = require("http");
const path = require("path");
const cors = require("cors");
const authMiddleware = require("./middleware/authMiddleware");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const connectDB = require("./config/db");
const socketIo = require("./socketIo"); 

const app = express();
const server = http.createServer(app);
const io = socketIo.initSocket(server); // Ensure socketIo properly exports initSocket

connectDB(); // Database connection (must handle errors properly)

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  cors({
    credentials: true,
    origin: process.env.FRONTEND_URL || "http://localhost:8000",
  })
);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); // Ensure views folder exists

app.use("/auth", authRoutes);
app.use("/chat", authMiddleware, chatRoutes); // Ensure authMiddleware is properly implemented

app.get("/", (req, res) => res.render("home"));
app.get("/login", (req, res) => res.render("login"));
app.get("/register", (req, res) => res.render("register"));
app.get("/verify-email", (req, res) => {
  res.render("emailverification", { error: "", userId: req.query.userId || "" });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
