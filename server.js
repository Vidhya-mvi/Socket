const express = require("express");
const authRoutes = require("./routes/authRoutes");
const http = require("http");
const path = require("path");
const cors = require("cors");
const {authMiddleware} = require("./middleware/authMiddleware");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = require("./config/db");
const socketIo = require("socket.io");
const User = require("./models/user");
const Chat = require("./models/chat");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:8000",
    methods: ["GET", "POST"],
  },
});

connectDB();

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
app.set("views", path.join(__dirname, "views"));

app.use("/auth", authRoutes);

app.get("/", (req, res) => res.render("home"));
app.get("/login", (req, res) => res.render("login"));
app.get("/register", (req, res) => res.render("register"));
app.get("/verify-email", (req, res) => {
  res.render("emailverification", { error: "", userId: req.query.userId || "" });
});

app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});


app.get("/chat/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send("User not found");
    }
    const users = await User.find({ _id: { $ne: req.user._id } });
    res.render("chat", { users, currentUser: req.user, chatUser: user });
  } catch (err) {
    res.status(500).send("Server error");
  }
});


app.post("/createGroup", authMiddleware, async (req, res) => {
  try {
    const { groupName } = req.body;

    
    const newGroup = new Chat({
      room: groupName,
      messages: [],
      users: [req.user._id],
    });

    await newGroup.save();
    res.json({ success: true, message: "Group created successfully", group: newGroup });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});


app.get("/groups", authMiddleware, async (req, res) => {
  try {
    const groups = await Chat.find();
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// socket.io
io.on("connection", (socket) => {
  let currentUser;
  socket.on("userLogin", (user) => {
    currentUser = user;
  });

  socket.on("userLogin", (user) => {
    currentUser = user;
    onlineUsers.set(user._id, socket.id);
    io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));
  });

 

  socket.on("joinRoom", async (room) => {
    if (!room) return;

    socket.join(room);

    try {
        const chat = await Chat.findOne({ room }).populate("messages.sender", "name _id"); 

        if (chat) {
            socket.emit("loadMessages", chat.messages);
        } else {
            socket.emit("loadMessages", []);
        }
    } catch (error) {
        console.error("Error loading messages:", error);
    }
});

  

socket.on("chatMessage", async (data) => {
  try {
      if (!data.sender || !mongoose.Types.ObjectId.isValid(data.sender)) return;

      let senderName = data.sender.name || null;

    
      if (!senderName) {
          const user = await User.findById(data.sender).select("name");
          senderName = user ? user.name : "Unknown";
      }

      let chat = await Chat.findOne({ room: data.room }).populate("messages.sender", "name _id");

      if (!chat) {
          chat = new Chat({ room: data.room, messages: [], users: [] });
      }

      const newMessage = {
          sender: new mongoose.Types.ObjectId(data.sender),
          message: data.message,
          timestamp: new Date(),
      };

      chat.messages.push(newMessage);
      await chat.save();

      
      const updatedChat = await Chat.findOne({ room: data.room })
          .populate("messages.sender", "name _id")
          .select("messages")
          .lean();

      const latestMessage = updatedChat.messages.slice(-1)[0];

      io.to(data.room).emit("chatMessage", {
          room: data.room,
          message: latestMessage.message,
          sender: {
              _id: latestMessage.sender._id,
              name: latestMessage.sender.name || "Unknown",
          },
          timestamp: latestMessage.timestamp,
      });

  } catch (error) {
      console.error("Error saving message:", error);
  }
});

  

  socket.on("leaveRoom", async (room) => {
    try {
      if (!room) return;
  
    
      let chat = await Chat.findOne({ room });
      if (chat) {
        await chat.save();
      }
  
      socket.leave(room);
      console.log(`${currentUser.name} left room: ${room}`);
    } catch (error) {
      console.error("Error saving chat on leave:", error);
    }
  });
  


  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", { errorMessage: err.message || "Internal Server Error" });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
