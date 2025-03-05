const chatModels = require("../models/chat");
const Chat = chatModels.Chat;
const Message = chatModels.Message;
const User = require("../models/user");
const Group = require("../models/group");
const mongoose = require("mongoose");

let io;
const connectedUsers = {}; // ✅ Fix: Declare connectedUsers

const setSocketIo = (socketIo) => {
    io = socketIo;
};

// ✅ Ensure user joins the chat room
const joinChat = (socket) => {
    socket.on("joinChat", async ({ chatId, userId }) => {
        try {
            console.log(`🔹 User ${userId} attempting to join chat: ${chatId}`);

            if (!mongoose.Types.ObjectId.isValid(chatId)) {
                return socket.emit("error", { message: "Invalid chat ID format" });
            }

            const chat = await Chat.findById(chatId).lean();
            if (!chat) return socket.emit("error", { message: "Chat does not exist" });

            if (!chat.participants.includes(userId)) {
                return socket.emit("error", { message: "You are not a participant in this chat" });
            }

            socket.join(chatId);
            connectedUsers[userId] = { socketId: socket.id, chatId };

            console.log(`✅ User ${userId} joined chat room: ${chatId}`);
            socket.to(chatId).emit("userJoined", { chatId, userId });
        } catch (error) {
            console.error("❌ Error in joinChat:", error);
            socket.emit("error", { message: "Failed to join chat" });
        }
    });
};

// ✅ Create or fetch a chat
const createChat = async (req, res) => {
    try {
        let { participants } = req.body;
        if (!participants || participants.length < 2) {
            return res.status(400).json({ error: "At least two participants required" });
        }

        participants = [...new Set([...participants, req.user.id])]; // ✅ Ensure unique participants

        let chat = await Chat.findOne({ 
            participants: { $all: participants, $size: participants.length } 
        }).lean();

        if (!chat) {
            chat = await new Chat({ participants }).save();
        }

        res.json(chat);
    } catch (error) {
        console.error("❌ Error creating chat:", error);
        res.status(500).json({ error: error.message });
    }
};

// ✅ Fetch all chats & groups
const getChats = async (req, res) => {
    try {
        const users = await User.find().lean();
        const groups = await Group.find().lean();

        res.render("chat", { user: req.user, users, groups });
    } catch (error) {
        console.error("❌ Error fetching chats:", error);
        res.status(500).send("Server Error");
    }
};

// ✅ Fetch chat details
const getChatById = async (req, res) => {
    try {
        const chatId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).render("error", { message: "Invalid chat ID format" });
        }

        const chat = await Chat.findById(chatId)
            .populate("participants", "name")
            .populate({ path: "lastMessage", populate: { path: "sender", select: "name" } });

        if (!chat) {
            return res.status(404).render("error", { message: "Chat not found" });
        }

        res.render("chatDetails", { chat, user: req.user });
    } catch (error) {
        console.error("❌ Error fetching chat:", error);
        res.status(500).render("error", { message: error.message });
    }
};

// ✅ Send a message
const sendMessage = async (req, res) => {
    try {
        const { chatId, content } = req.body;
        if (!chatId || !content.trim()) {
            return res.status(400).json({ error: "Chat ID and message content are required" });
        }

        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(req.user.id)) {
            return res.status(403).json({ error: "Invalid chat or not a participant" });
        }

        const message = new Message({ chatId, sender: req.user.id, content });
        await message.save();

        chat.lastMessage = message._id;
        await chat.save();

        io.to(chatId.toString()).emit("receiveMessage", {
            chatId,
            sender: { _id: req.user.id, name: req.user.name },
            content,
            createdAt: message.createdAt,
        });

        res.status(201).json(message);
    } catch (error) {
        console.error("❌ Error sending message:", error);
        res.status(500).json({ error: "Error sending message" });
    }
};

// ✅ Paginated fetching of messages
const getMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const messages = await Message.find({ chatId })
            .populate("sender", "name")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({ messages, currentPage: page, total: messages.length });
    } catch (error) {
        console.error("❌ Failed to load messages:", error);
        res.status(500).json({ error: "Failed to load messages" });
    }
};

// ✅ Search users by name
const searchUsers = async (req, res) => {
    try {
        const searchQuery = req.query.q?.trim();
        if (!searchQuery) return res.render("chat", { chats: [], users: [], user: req.user });

        const users = await User.find({ name: { $regex: new RegExp(searchQuery, "i") } })
            .select("name _id").lean();

        res.render("chat", { chats: [], users, user: req.user });
    } catch (error) {
        res.status(500).render("error", { message: error.message });
    }
};

// ✅ Create group chat
const createGroupChat = async (req, res) => {
    try {
        const { chatName, users } = req.body;
        if (!users || users.length < 2) {
            return res.status(400).json({ error: "A group must have at least 2 participants" });
        }

        const uniqueUsers = [...new Set([...users, req.user.id])];

        const newGroupChat = new Chat({
            chatName,
            participants: uniqueUsers,
            isGroupChat: true,
            groupAdmin: req.user.id,
        });

        await newGroupChat.save();
        res.status(201).json(newGroupChat);
    } catch (error) {
        console.error("❌ Error creating group chat:", error);
        res.status(500).json({ error: "Error creating group chat" });
    }
};

// ✅ Add user to group chat
const addUserToGroup = async (req, res) => {
    try {
        const { chatId, userId } = req.body;
        const chat = await Chat.findById(chatId);

        if (!chat || !chat.isGroupChat || chat.groupAdmin.toString() !== req.user.id) {
            return res.status(403).json({ error: "Unauthorized action" });
        }

        if (!chat.participants.includes(userId)) {
            chat.participants.push(userId);
            await chat.save();
        }

        res.status(200).json(chat);
    } catch (error) {
        res.status(500).json({ error: "Error adding user" });
    }
};

module.exports = {
    setSocketIo,
    joinChat,
    createChat,
    getChats,
    getChatById,
    searchUsers,
    sendMessage,
    getMessages,
    createGroupChat,
    addUserToGroup,
};
