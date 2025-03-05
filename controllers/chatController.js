const mongoose = require("mongoose");
const { Chat, Message } = require("../models/chat");
const User = require("../models/user");
const Group = require("../models/group");






// ✅ Create a new chat (fixes duplicate chat issue)
const createChat = async (req, res) => {
    try {
        let { participants } = req.body;
        console.log("Creating chat with participants:", participants);

        if (!participants || participants.length !== 1) {
            return res.redirect("/chat?error=You can only chat with one other person at a time.");
        }

        const userId = req.user.id;
        const otherUserId = participants[0];

        if (userId === otherUserId) {
            return res.redirect("/chat?error=You cannot chat with yourself.");
        }

        const chatParticipants = [userId, otherUserId].sort();

        // 🔹 Ensure an exact 2-user match to prevent duplicate chats
        let chat = await Chat.findOne({
            participants: { $all: chatParticipants, $size: 2 },
            isGroupChat: false
        });

        if (!chat) {
            chat = new Chat({ participants: chatParticipants, isGroupChat: false });
            await chat.save();
            console.log("New chat created:", chat._id);
        } else {
            console.log("Chat already exists:", chat._id);
        }

        res.redirect(`/chat/${chat._id}`);
    } catch (error) {
        console.error("Error creating chat:", error);
        res.render("error", { message: "Error creating chat" });
    }
};


// ✅ Fetch all chats
const getChats = async (req, res) => {
    try {
        console.log("Fetching all chats for user:", req.user.id);
        const users = await User.find().lean();
        const groups = await Group.find().lean();
        res.render("chat", { user: req.user, users, groups });
    } catch (error) {
        console.error("Error fetching chats:", error);
        res.render("error", { message: "Server Error" });
    }
};

// ✅ Fetch chat by ID
const getChatById = async (req, res) => {
    try {
        const chatId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.render("error", { message: "Invalid chat ID format" });
        }

        const chat = await Chat.findById(chatId)
            .populate("participants", "name")
            .populate({ path: "lastMessage", populate: { path: "sender", select: "name" } });

        if (!chat) {
            return res.render("error", { message: "Chat not found" });
        }

        res.render("chatDetails", { chat, user: req.user });
    } catch (error) {
        console.error("Error fetching chat:", error);
        res.render("error", { message: error.message });
    }
};

// ✅ Send a message
const sendMessage = async (req, res) => {
    try {
        const { chatId, content } = req.body;

        if (!chatId || !content.trim()) {
            return res.redirect(`/chat/${chatId}?error=Message cannot be empty`);
        }

        let chat = await Chat.findById(chatId);
        if (!chat) {
            return res.redirect(`/chat?error=Chat not found`);
        }

        if (!chat.participants.includes(req.user.id)) {
            return res.redirect(`/chat/${chatId}?error=You are not part of this chat`);
        }

        const message = new Message({
            chatId: chat._id,
            sender: req.user.id,
            content,
        });

        await message.save();

        chat.lastMessage = message._id;
        await chat.save();

        io.to(chat._id.toString()).emit("receiveMessage", {
            chatId: chat._id,
            sender: { _id: req.user.id, name: req.user.name },
            content,
            createdAt: message.createdAt,
        });

        res.redirect(`/chat/${chat._id}`);
    } catch (error) {
        console.error("Error sending message:", error);
        res.render("error", { message: "Error sending message" });
    }
};

// ✅ Fetch messages for a chat (prevents unwanted chat creation)
const getMessages = async (req, res) => {
    try {
        const { chatId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.render("error", { message: "Invalid chat ID format" });
        }

        let chat = await Chat.findById(chatId);
        if (!chat) {
            return res.render("error", { message: "Chat not found" });
        }

        const messages = await Message.find({ chatId: chat._id })
            .populate("sender", "name")
            .sort({ createdAt: -1 })
            .limit(20);

        res.render("messages", { messages, user: req.user, chat });
    } catch (error) {
        console.error("Failed to load messages:", error);
        res.render("error", { message: "Failed to load messages" });
    }
};

// ✅ Create a group chat
const createGroupChat = async (req, res) => {
    try {
        const { chatName, users } = req.body;
        if (!users || users.length < 2) {
            return res.redirect("/chat?error=A group must have at least 2 participants");
        }

        const uniqueUsers = [...new Set([...users, req.user.id])];

        const newGroupChat = new Chat({
            chatName,
            participants: uniqueUsers,
            isGroupChat: true,
            groupAdmin: req.user.id,
        });

        await newGroupChat.save();
        res.redirect("/chat");
    } catch (error) {
        console.error("Error creating group chat:", error);
        res.render("error", { message: "Error creating group chat" });
    }
};

// ✅ Add user to group
const addUserToGroup = async (req, res) => {
    try {
        const { chatId, userId } = req.body;
        const chat = await Chat.findById(chatId);

        if (!chat || !chat.isGroupChat || chat.groupAdmin.toString() !== req.user.id) {
            return res.render("error", { message: "Unauthorized action" });
        }

        if (!chat.participants.includes(userId)) {
            chat.participants.push(userId);
            await chat.save();
        }

        res.redirect("/chat");
    } catch (error) {
        res.render("error", { message: "Error adding user" });
    }
};

module.exports = {
    createChat,
    getChats,
    getChatById,
    sendMessage,
    getMessages,
    createGroupChat,
    addUserToGroup,
}; 
