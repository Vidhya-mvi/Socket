const express = require("express");
const {
    createChat,
    getChats,
    getChatById,
    searchUsers,
    sendMessage,
    getMessages,
    createGroupChat,
    addUserToGroup,
    removeUserFromGroup
} = require("../controllers/chatController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Private Chat Routes
router.post("/create", authMiddleware, createChat);
router.get("/", authMiddleware, getChats);
router.get("/search/users", authMiddleware, searchUsers); // ✅ Move above dynamic `:id` routes
router.get("/:id", authMiddleware, getChatById);

// Message Routes
router.post("/message", authMiddleware, sendMessage);
router.get("/:chatId/messages", authMiddleware, getMessages);

// Group Chat Routes (Improved structure)
router.post("/group/create", authMiddleware, createGroupChat);
router.post("/group/:groupId/add", authMiddleware, addUserToGroup); // ✅ More intuitive
// router.post("/group/:groupId/remove", authMiddleware, removeUserFromGroup); // ✅ More intuitive

module.exports = router;
