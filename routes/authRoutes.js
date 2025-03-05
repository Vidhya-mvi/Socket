const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.get("/login", (req, res) => {
  res.render("login");
});


router.get("/register", (req, res) => {
  res.render("register");
});


router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/verify-email", authController.verifyEmail);


router.get("/logout", (req, res) => {
  res.clearCookie("token");

 
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  res.redirect("/login");
});

module.exports = router;
