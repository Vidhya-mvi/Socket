const express = require("express");
const {
    createChat,
    getChats,
    getChatById,
    getMessages,
    createGroupChat,
    addUserToGroup
} = require("../controllers/chatController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


router.post("/create", authMiddleware, createChat);
router.get("/", authMiddleware, getChats);
router.get("/:id", authMiddleware, getChatById);


router.get("/:chatId/messages", authMiddleware, getMessages);


router.post("/group/create", authMiddleware, createGroupChat);
router.post("/group/:groupId/add", authMiddleware, addUserToGroup);

module.exports = router;
              