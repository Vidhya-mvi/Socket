const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {authRedirect}= require("../middleware/authMiddleware")

router.get("/login", authRedirect, (req, res) => {
  res.render("login");
});

router.get("/register", authRedirect, (req, res) => {
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


router.get("/error-test", (req, res) => {
  throw new Error("This is a test error!");
});

module.exports = router;
