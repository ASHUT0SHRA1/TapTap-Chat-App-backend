const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const User = require("./models/user");
const Message = require("./models/message")
const app = express();
const jwt = require('jsonwebtoken')
const PORT = 8000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

mongoose.connect("mongodb+srv://ashutoshrai126:AsHu123@cluster0.tbp3mtb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Connected to MongoDB");
}).catch((err) => {
    console.log(err);
});

app.get('/', (req, res) => {
    res.send("HI");
});



app.listen(PORT, () => {
    console.log(`APP launched successfully on port ${PORT}`);
});

app.post("/register", (req, res) => {
    const { name, email, password, image } = req.body;
    const newUser = new User({ name, email, password, image });
    newUser.save()
        .then(() => {
            res.status(200).json({
                message: "User Registered Successfully",
            });
        })
        .catch((err) => {
            console.log(err);
            res.status(500).json({
                message: "Error registering the user"
            });
        });
});

//function to create Token for the user
const createToken = (userId) => {
    const payload = {
        userId: userId,
    }
    const token = jwt.sign(payload, "abcdef", { expiresIn: 60 * 30 });
    return token; // Ensure to return the generated token
}

//end point for logging in of a particular user
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    User.findOne({ email }).then((user) => {
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.password !== password) {
            return res.status(401).json({ message: "Invalid password" });
        }

        const token = createToken(user._id);
        // console.log(token);
        res.status(200).json({ message : token,  user : user._id });
    }).catch((err) => {
        console.error("Error in finding the user", err);
        res.status(500).json({ message: "Internal Server error" });
    });
});


//endpoint to access all the users except the user who's is currently logged in!
app.get("/users/:userId", (req, res) => {
    const loggedInUserId = req.params.userId;
  
    User.find({ _id: { $ne: loggedInUserId } })
      .then((users) => {
        res.status(200).json(users);
      })
      .catch((err) => {
        console.log("Error retrieving users", err);
        res.status(500).json({ message: "Error retrieving users" });
      });
  });

  
//endpoint to send a request to a user
app.post("/friend-request", async (req, res) => {
    const { currentUserId, selectedUserId } = req.body;
  
    try {
      //update the recepient's friendRequestsArray!
      await User.findByIdAndUpdate(selectedUserId, {
        $push: { friendRequest: currentUserId },
      });
  
      //update the sender's sentFriendRequest array
      await User.findByIdAndUpdate(currentUserId, {
        $push: { sentFriendRequest: selectedUserId },
      });
  
      res.sendStatus(200);
    } catch (error) {
      res.sendStatus(500);
    }
  });
  
  //endpoint to show all the friend-requests of a particular user
  app.get("/friend-request/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
  
      //fetch the user document based on the User id
      const user = await User.findById(userId)
        .populate("friendRequest", "name email image")
        .lean();
  
      const friendRequest = user.friendRequest;
  
      res.json(friendRequest);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
  
  //endpoint to accept a friend-request of a particular person
  app.post("/friend-request/accept", async (req, res) => {
    try {
      const { senderId, recepientId } = req.body;
  
      //retrieve the documents of sender and the recipient
      const sender = await User.findById(senderId);
      const recepient = await User.findById(recepientId);
  
      sender.friends.push(recepientId);
      recepient.friends.push(senderId);
  
      recepient.friendRequest = recepient.friendRequest.filter(
        (request) => request.toString() !== senderId.toString()
      );
  
      sender.sentFriendRequest = sender.sentFriendRequest.filter(
        (request) => request.toString() !== recepientId.toString
      );
  
      await sender.save();
      await recepient.save();
  
      res.status(200).json({ message: "Friend Request accepted successfully" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
  
  //endpoint to access all the friends of the logged in user!
  app.get("/accepted-friends/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await User.findById(userId).populate(
        "friends",
        "name email image"
      );
      const acceptedFriends = user.friends;
      res.json(acceptedFriends);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  const multer = require("multer");
  
  // Configure multer for handling file uploads
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "files/"); // Specify the desired destination folder
    },
    filename: function (req, file, cb) {
      // Generate a unique filename for the uploaded file
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  });

  const upload = multer({ storage: storage });
  
  //endpoint to post Messages and store it in the backend
  app.post("/messages", upload.single("imageFile"), async (req, res) => {
    try {
      const { senderId, recepientId, messageType, messageText } = req.body;
  
      const newMessage = new Message({
        senderId,
        recepientId,
        messageType,
        message: messageText,
        timestamp: new Date(),
        imageUrl: messageType === "image" ? req.file.path : null,
      });
  
      await newMessage.save();
      res.status(200).json({ message: "Message sent Successfully" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  
  ///endpoint to get the userDetails to design the chat Room header
  app.get("/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
  
      //fetch the user data from the user ID
      const recepientId = await User.findById(userId);
  
      res.json(recepientId);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  //endpoint to fetch the messages between two users in the chatRoom
  app.get("/messages/:senderId/:recepientId", async (req, res) => {
    try {
      const { senderId, recepientId } = req.params;
  
      const messages = await Message.find({
        $or: [
          { senderId: senderId, recepientId: recepientId },
          { senderId: recepientId, recepientId: senderId },
        ],
      }).populate("senderId", "_id name");
  
      res.json(messages);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  //endpoint to delete the messages!
  app.post("/deleteMessages", async (req, res) => {
    try {
      const { messages } = req.body;
  
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: "invalid req body!" });
      }
  
      await Message.deleteMany({ _id: { $in: messages } });
  
      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Internal Server" });
    }
  });
  
  
  
  app.get("/friend-requests/sent/:userId",async(req,res) => {
    try{
      const {userId} = req.params;
      const user = await User.findById(userId).populate("sentFriendRequest","name email image").lean();
  
      const sentFriendRequest = user.sentFriendRequest;
  
      res.json(sentFriendRequest);
    } catch(error){
      console.log("error",error);
      res.status(500).json({ error: "Internal Server" });
    }
  })
  
  app.get("/friends/:userId",(req,res) => {
    try{
      const {userId} = req.params;
  
      User.findById(userId).populate("friends").then((user) => {
        if(!user){
          return res.status(404).json({message: "User not found"})
        }
  
        const friendIds = user.friends.map((friend) => friend._id);
  
        res.status(200).json(friendIds);
      })
    } catch(error){
      console.log("error",error);
      res.status(500).json({message:"internal server error"})
    }
  })