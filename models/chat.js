const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {  
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true, 
  },
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  }
}, { timestamps: true });

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  isGroupChat: {
    type: Boolean,
    default: false
  },
  groupName: {
    type: String,
    required: function () { return this.isGroupChat; },
  },
  admins: [{ 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lastMessage: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }
}, { timestamps: true });

// Update lastMessage after a message is saved
messageSchema.post('save', async function (doc, next) {
  try {
    await mongoose.model('Chat').findByIdAndUpdate(doc.chatId, {
      lastMessage: doc._id
    });
  } catch (error) {
    console.error("Error updating lastMessage in Chat model:", error);
  }
  next();
});

const Chat = mongoose.model('Chat', chatSchema);
const Message = mongoose.model('Message', messageSchema);

module.exports = { Chat, Message };
