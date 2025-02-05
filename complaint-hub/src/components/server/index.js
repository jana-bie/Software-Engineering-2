const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const Counter = require("./models/counter");  // Import Counter model
const userModel = require("./models/user");
const form7Model = require("./models/form7");

const app = express();
app.use(express.json());
app.use(cors());

// Connect to the 'user' database for user registration and login
mongoose.connect("mongodb://127.0.0.1:27017/user_SE", { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to 'user' database"))
  .catch((err) => console.log("Error connecting to 'user' database:", err));

// Connect to the 'form7_data' database for Form 7 data
const form7Db = mongoose.createConnection("mongodb://127.0.0.1:27017/form7_data", { useNewUrlParser: true, useUnifiedTopology: true });
form7Db.on('connected', () => {
  console.log("Connected to 'form7_data' database");
});

// Login route
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  console.log("Incoming login request:", req.body);  // Log the incoming data

  userModel.findOne({ username: username })
    .then((user) => {
      if (user) {
        console.log("User found:", user);  // Check the user object and password hash
        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) {
            return res.status(500).json({ error: "Error during password comparison" });
          }

          if (isMatch) {
            res.json("Login successful " + user.fullname);
          } else {
            res.json("The username or password is incorrect");
          }
        });
      } else {
        res.json("You have no Account, Sign up first?");
      }
    })
    .catch((err) => {
      res.status(500).json({ error: "Database error during login" });
    });
});

// Register route
app.post("/register", (req, res) => {
  console.log(req.body); // Log incoming data

  // Hash the password before saving
  bcrypt.hash(req.body.password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ error: "Failed to hash password" });
    }

    // Replace the plain password with the hashed password
    req.body.password = hashedPassword;

    // Create the user with the hashed password
    userModel.create(req.body)
      .then((user) => res.json(user))
      .catch((err) => res.json(err));
  });
});

// Form7 route
app.post("/form7", async (req, res) => {
  try {
    // Get next kpCaseNumber and usapingBlg
    const kpCounter = await Counter.findOneAndUpdate(
      { name: "kpCaseNumber" },
      { $inc: { count: 1 } },
      { new: true, upsert: true }
    );

    const blgCounter = await Counter.findOneAndUpdate(
      { name: "usapingBlg" },
      { $inc: { count: 1 } },
      { new: true, upsert: true }
    );

    // Log the incoming form data
    console.log(req.body);

    // Add the generated kpCaseNumber and usapingBlg to the form data
    const form7Data = {
      ...req.body,  // Existing form data
      kpCaseNumber: kpCounter.count,  // Add the generated kpCaseNumber
      usapingBlg: blgCounter.count,  // Add the generated usapingBlg
    };

    // Create the form7 entry with the additional data
    form7Db.model('Form7', form7Model.schema)  // Use form7Db for the 'Form7' model
      .create(form7Data)
      .then((form7) => res.json(form7))  // Return the saved form7 data, including the generated numbers
      .catch((err) => res.json(err));

  } catch (err) {
    res.json(err);
  }
});

app.listen(3001, () => {
  console.log("server is running!!");
});
