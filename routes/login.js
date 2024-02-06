var express = require('express');
var router = express.Router();
const passport = require('passport')
const {pool} = require("../dbConfig");
const bcrypt = require("bcrypt");


/* GET home page. */
router.get('/', checkAuthenticated, function(req, res, next) {
  res.render('login');
});

router.post('/', async (req, res) => {
  // Your route logic goes here
  let radnoMjestoID
  const results = await pool.query('SELECT radno_mjesto_id FROM users WHERE email = $1', [req.body.email])
  if(results.rows.length == 0) {
    req.flash('success_msg', "Neispravan email!")
    return res.redirect('/login')
  }

  if (results.rows.length > 0) {
    radnoMjestoID = results.rows[0].radno_mjesto_id;
    if (radnoMjestoID === 1) {
      passport.authenticate('local', {
        successRedirect: '/admin',
        failureRedirect: '/login',
        failureFlash: true
      })(req, res);
    } else {
      passport.authenticate('local', {
        //successRedirect: '/dashboard',
        failureRedirect: '/login',
        failureFlash: true
      })(req, res, () => {
        res.redirect('/dashboard')
      });
    }
  } else {

}}
);



function checkAuthenticated(req, res, next) { // da zabranimo pristup ako je logovan
  if(req.isAuthenticated()) {
    return res.redirect('/dashboard')
  }
  next()
}


module.exports = router;
