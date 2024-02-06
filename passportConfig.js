const LocalStrategy = require('passport-local').Strategy
const { pool } = require('./dbConfig')
const bcrypt = require("bcrypt")

// inicializiramo Local Strategy
function initialize(passport) {
    const autheticateUser = async (email, password, done)=>{
        pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email], (err, results)=>{
                if(err) {
                    throw err
                }
                

                if((results.rows).length > 0) { // pronasao je usera
                    const user = results.rows[0];
                    bcrypt.compare(password, user.password, (err, isMatch)=>{ // funkcija koja poredi hash lozinku i unijetu lozinku
                        if(err) {
                            throw err
                        }
                        if(isMatch) {

                            return done(null, user) // prvi parametar je error = null, user vraca korisnika i sprema ga u session cookie
                        } else {
                            return done(null, false, {message: "Password is not correct"}) // nema nikakve prave greske zato je null, vracamo user=false i poruku
                        }
                    })
                } else { // nismo pronasli korisnika u bazi
                    return done(null, false, {message: "Email is not registred"})
                }
            }
        )
    }
    passport.use(new LocalStrategy({
        usernameField: "email",
        passwordField: "password",
        nadredjeniField: "nadredjeni_id"
    },
        autheticateUser
    )
    )

    passport.serializeUser((user, done)=> done(null, user.id)) // hocemo da store user.id u session
    passport.deserializeUser((id, done)=>{
        pool.query(
            'SELECT * FROM users WHERE id = $1', [id], (err, results)=>{
                if(err) {
                    throw err
                }
                return done(null, results.rows[0]) // sacuvamo user objects unutar sesije
            }
        )
    })
}
module.exports = initialize;