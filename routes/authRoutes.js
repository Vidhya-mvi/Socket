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
  console.log(" Logging out...");
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

module.exports = router;
