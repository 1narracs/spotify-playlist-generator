const express = require('express');
const router = express.Router();
const axios = require("axios");
const app = require('../app');

/* GET home page. */
router.get("/", function(req, res) {
    res.render('index');
});

module.exports = router;