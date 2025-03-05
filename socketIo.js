const socketIo = require("socket.io");
const mongoose = require("mongoose");
const { Chat, Message } = require("./models/chat");

let io;
const connectedUsers = {}; // Stores { userId: { socketId, chatId } }

exports.initSocket = (server) => {
    io = socketIo(server, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:8000",
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        console.log(` New WebSocket connection: ${socket.id}`);

       
        socket.on("registerUser", (userId) => {
            if (!userId) {
                console.error(" registerUser: Missing userId");
                return;
            }

            // Remove old socket if the user was already connected
            if (connectedUsers[userId]) {
                console.warn(`User ${userId} reconnected, replacing old socket.`);
                delete connectedUsers[userId];
            }

            connectedUsers[userId] = { socketId: socket.id };
            console.log(` Registered user: ${userId} with socket ID: ${socket.id}`);
        });

        // 📌 User Joins a Chat
        socket.on("joinChat", async ({ chatId, userId }) => {
            try {
                if (!mongoose.Types.ObjectId.isValid(chatId)) {
                    console.error(" Invalid chat ID:", chatId);
                    socket.emit("error", { message: "Invalid chat ID format" });
                    return;
                }

                const chat = await Chat.findById(chatId);
                if (!chat) {
                    console.error(" Chat not found:", chatId);
                    socket.emit("error", { message: "Chat not found" });
                    return;
                }

                if (!chat.participants.includes(userId)) {
                    console.error(" Unauthorized: User not in chat", userId);
                    socket.emit("error", { message: "You are not a participant in this chat" });
                    return;
                }

                // Remove previous chat association if user was already in a chat
                if (connectedUsers[userId]?.chatId) {
                    socket.leave(connectedUsers[userId].chatId);
                }

                socket.join(chatId);
                connectedUsers[userId] = { socketId: socket.id, chatId };

                console.log(` User ${userId} joined chat room: ${chatId}`);
                socket.to(chatId).emit("userJoined", { chatId, userId });
            } catch (error) {
                console.error(" Error in joinChat:", error);
                socket.emit("error", { message: "Failed to join chat" });
            }
        });

        // 📌 Send a Message
        socket.on("sendMessage", async ({ chatId, senderId, content }) => {
            try {
                if (!chatId || !senderId || !content?.trim()) {
                    console.error(" sendMessage: Missing required fields");
                    socket.emit("error", { message: "Chat ID, sender ID, and message content are required" });
                    return;
                }

                const chat = await Chat.findById(chatId);
                if (!chat) {
                    console.error(` Chat not found: ${chatId}`);
                    socket.emit("error", { message: "Chat not found" });
                    return;
                }

                if (!chat.participants.includes(senderId)) {
                    console.error(` Unauthorized message attempt by ${senderId}`);
                    socket.emit("error", { message: "You are not a participant in this chat" });
                    return;
                }

                const message = new Message({ chatId, sender: senderId, content });
                await message.save();

                chat.lastMessage = message._id;
                await chat.save();

                io.to(chatId).emit("receiveMessage", {
                    chatId,
                    sender: { _id: senderId },
                    content,
                    createdAt: message.createdAt,
                });

                console.log(`Message sent in chat ${chatId} by ${senderId}`);
            } catch (error) {
                console.error(" Error sending message:", error);
                socket.emit("error", { message: "Failed to send message" });
            }
        });

        // 📌 Handle Disconnection
        socket.on("disconnect", () => {
            handleUserDisconnect(socket.id);
        });
    });

    return io;
};

// 📌 Handle user disconnection separately
const handleUserDisconnect = (socketId) => {
    const userId = Object.keys(connectedUsers).find(
        (id) => connectedUsers[id].socketId === socketId
    );

    if (userId) {
        const { chatId } = connectedUsers[userId];
        delete connectedUsers[userId];

        console.log(` User ${userId} disconnected from chat ${chatId || "N/A"}`);

        if (chatId) {
            io.to(chatId).emit("userDisconnected", { userId, chatId });
        }
    } else {
        console.log(`Unknown user disconnected: ${socketId}`);
    }
};

exports.getSocket = () => {
    if (!io) {
        throw new Error("Socket.io not initialized! Call initSocket(server) first.");
    }
    return io;
};
