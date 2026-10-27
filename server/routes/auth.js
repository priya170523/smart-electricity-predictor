const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

module.exports = function createAuthRouter(User) {
  const router = express.Router();

  router.post("/register", async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string"
      ) {
        return res.status(400).json({
          message: "Name, email, and password are required.",
        });
      }

      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();

      if (cleanName.length < 2 || cleanName.length > 80) {
        return res.status(400).json({
          message: "Name must contain between 2 and 80 characters.",
        });
      }

      if (
        cleanEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
      ) {
        return res.status(400).json({
          message: "Please enter a valid email address.",
        });
      }

      if (password.length < 8 || password.length > 72) {
        return res.status(400).json({
          message: "Password must contain between 8 and 72 characters.",
        });
      }

      const existingUser = await User.findOne({ email: cleanEmail });

      if (existingUser) {
        return res.status(409).json({
          message: "An account with this email already exists. Please log in.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await User.create({
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
      });

      const token = jwt.sign(
        { userId: user._id.toString() },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.status(201).json({
        message: "Registration successful.",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "An account with this email already exists.",
        });
      }

      console.error("Registration error:", error.message);

      return res.status(500).json({
        message: "Unable to register. Please try again.",
      });
    }
  });

  router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (
        typeof email !== "string" ||
        typeof password !== "string"
      ) {
        return res.status(400).json({
          message: "Email and password are required.",
        });
      }

      const user = await User.findOne({
        email: email.trim().toLowerCase(),
      }).select("+password");

      if (!user) {
        return res.status(401).json({
          message: "Invalid email or password.",
        });
      }

      const passwordMatches = await bcrypt.compare(
        password,
        user.password
      );

      if (!passwordMatches) {
        return res.status(401).json({
          message: "Invalid email or password.",
        });
      }

      const token = jwt.sign(
        { userId: user._id.toString() },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.json({
        message: "Login successful.",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      console.error("Login error:", error.message);

      return res.status(500).json({
        message: "Unable to log in. Please try again.",
      });
    }
  });

  return router;
};
