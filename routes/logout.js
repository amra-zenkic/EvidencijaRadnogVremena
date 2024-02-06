var express = require('express');
var router = express.Router();
const passport = require('passport')
const flash = require('express-flash')

/* GET home page. */
router.get('/', function(req, res, next) {
  req.logOut(function (err) {
    if(err) {
      throw err
    }
    req.flash('success_msg', "Odjavili ste se!")
    res.redirect('/login')
  })

});

module.exports = router;
