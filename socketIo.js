const socketIo = require("socket.io");
const mongoose = require("mongoose");
const { Chat, Message } = require("./models/chat");

let io;
const connectedUsers = {}; // { userId: { socketId, chatId } }

exports.initSocket = (server) => {
    io = socketIo(server, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:8000",
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        console.log(`✅ New WebSocket connection: ${socket.id}`);

        // ✅ Register user with WebSocket
        socket.on("registerUser", (userId) => {
            if (!userId) {
                console.error("❌ registerUser: Missing userId");
                return;
            }

            // 🛑 If user already connected, force logout
            if (connectedUsers[userId]) {
                console.warn(`⚠️ User ${userId} already connected. Logging them out.`);
                io.to(connectedUsers[userId].socketId).emit("forceLogout"); 
                delete connectedUsers[userId]; 
            }

            // ✅ Store user socket info
            connectedUsers[userId] = { socketId: socket.id };
            console.log(`✅ Registered user: ${userId} (Socket ID: ${socket.id})`);
        });

        // ✅ Handle user joining a chat
        socket.on("joinChat", async ({ userId, otherUserId }) => {
            if (!userId || !otherUserId) {
                console.error("❌ joinChat: Missing userId or otherUserId");
                socket.emit("error", { message: "Invalid user ID" });
                return;
            }
        
            try {
                let chat = await Chat.findOne({
                    participants: { $all: [userId, otherUserId] }
                });
        
                if (!chat) {
                    console.log(`⚠️ No existing chat found. Creating new chat for ${userId} and ${otherUserId}`);
        
                    chat = new Chat({ participants: [userId, otherUserId], messages: [] });
                    await chat.save();
                    console.log(`✅ New chat created: ${chat._id}`);
                }
        
                socket.join(chat._id);
                connectedUsers[userId] = { socketId: socket.id, chatId: chat._id };
        
                console.log(`✅ User ${userId} joined chat room: ${chat._id}`);
                socket.to(chat._id).emit("userJoined", { chatId: chat._id, userId });
        
                socket.emit("chatJoined", { chatId: chat._id });
            } catch (error) {
                console.error("❌ Error in joinChat:", error);
                socket.emit("error", { message: "Failed to join or create chat" });
            }
        });
          // ✅ Handle sending messages
          socket.on("sendMessage", async ({ chatId, senderId, content }) => {
            try {
                if (!chatId || !senderId || !content?.trim()) {
                    console.error("❌ sendMessage: Missing required fields");
                    socket.emit("error", { message: "Chat ID, sender ID, and message content are required" });
                    return;
                }
        
                const chat = await Chat.findById(chatId);
                if (!chat) {
                    console.error(`❌ sendMessage: Chat not found: ${chatId}`);
                    socket.emit("error", { message: "Chat not found" });
                    return;
                }
        
                if (!chat.participants.includes(senderId)) {
                    console.error(`❌ Unauthorized message attempt by ${senderId}`);
                    socket.emit("error", { message: "You are not a participant in this chat" });
                    return;
                }
        
                // ✅ Save message in database
                const message = new Message({ chatId, sender: senderId, content });
                await message.save();
        
                chat.lastMessage = message._id;
                await chat.save();
        
                // ✅ Broadcast message to chat room
                io.to(chatId).emit("receiveMessage", {
                    chatId,
                    sender: { _id: senderId },
                    content,
                    createdAt: message.createdAt,
                });
        
                console.log(`✅ Message sent in chat ${chatId} by ${senderId}`);
            } catch (error) {
                console.error("❌ Error sending message:", error);
                socket.emit("error", { message: "Failed to send message" });
            }
        });
        
        socket.on("receiveMessage", (data) => {
            console.log("🔹 New message received:", data);
        
            // Ensure message is shown only if the user is in the correct chat
            if (data.chatId === currentChatId) {
                appendMessage(data.content, data.sender._id === userId ? "sent" : "received");
            }
        });
        

        // ✅ Handle user disconnection
        socket.on("disconnect", () => {
            console.log(`🔻 Socket disconnected: ${socket.id}`);
            handleUserDisconnect(socket.id);
        });
    });

    return io;
};

// ✅ Handle user disconnect
const handleUserDisconnect = (socketId) => {
    const userId = Object.keys(connectedUsers).find(
        (id) => connectedUsers[id].socketId === socketId
    );

    if (userId) {
        const { chatId } = connectedUsers[userId];
        delete connectedUsers[userId];

        console.log(`❌ User ${userId} disconnected from chat ${chatId || "N/A"}`);

        if (chatId) {
            io.to(chatId).emit("userDisconnected", { userId, chatId });
        }
    } else {
        console.log(`⚠️ Unknown user disconnected: ${socketId}`);
    }
};

// ✅ Get Socket instance
exports.getSocket = () => {
    if (!io) {
        throw new Error("❌ Socket.io not initialized! Call initSocket(server) first.");
    }
    return io;
};
