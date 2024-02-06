var express = require('express');
const {pool} = require("../dbConfig");
var router = express.Router();

/* GET home page. */
router.get('/', async function(req, res, next) {
  // provjeravamo koji korisnik zeli da pristupi dashboard-u
  if(req.isAuthenticated()) {
      if(req.user.radno_mjesto_id === 1) {
        return res.redirect('/admin')
      }
      else {
        // da li je dosao na posao ili je otisao ili...
        await pool.connect(async (err, client, done) => {
          client.query(`select
                        dolazak,
                        odlazak
                    from evidencija_radnog_vremena
                    where radnik_id = $1 and datum = current_date;`, [req.user.id], (err, results2) => {
            if(err)
              throw err

            client.query(`select
                            (select count(*)
                            from projekti_i_radnici pr
                            join projekti p on p.id = pr.projekat_id
                            where pr.radnik_id = $1 and p.status_projekta is not null) as aktivniProjekti,
                            (select count(*)
                            from projekti_i_radnici pr
                            join projekti p on p.id = pr.projekat_id
                            where pr.radnik_id = $2 and p.status_projekta is null) as zavrseniProjekti,
                            (select count(*)
                            from taskovi t
                            where t.potroseno_vrijeme_na_tasku is not null and t.radnik_id = $3) as zavrsenTaskovi,
                            (select count(*)
                            from taskovi t
                            where t.potroseno_vrijeme_na_tasku is null and t.radnik_id = $4) as aktivniTaskovi;`,
                        [req.user.id,req.user.id,req.user.id,req.user.id], (err, results3) => {
              if(err)
                throw err
              if(req.user.radno_mjesto_id == 3) {
                done()
                if(results2.rows.length === 0) { // nije došao na ovaj datum još => mora se prijaviti da dolazi
                  res.render('dashboard',{ radnoMjestoID: req.user.radno_mjesto_id , dolazi: true, podaci: results3.rows[0]})
                } else if(results2.rows[0].odlazak !== null && results2.rows[0].odlazak !== undefined) {
                  res.render('dashboard',{ radnoMjestoID: req.user.radno_mjesto_id , dolazi: false, otisao: true, podaci: results3.rows[0]})
                } else {
                  res.render('dashboard',{ radnoMjestoID: req.user.radno_mjesto_id , dolazi: false, otisao: false, podaci: results3.rows[0]})
                }
              }
              else { // pronalizimo radnike kojima je ovaj menadzer nadredjen
                client.query(`select
                                  concat(u.name, ' ', u.surname) as ime_i_prezime,
                                  u.email,
                                  rm.naziv_radnog_mjesta
                              from users u
                              join radna_mjesta rm on rm.id = u.radno_mjesto_id
                              where u.nadredjeni_id = $1;`, [req.user.id], (err, results4) => {
                  done()
                  if(err)
                    throw err
                  if(results2.rows.length === 0) { // nije došao na ovaj datum još => mora se prijaviti da dolazi
                    res.render('dashboard',{ radnoMjestoID: req.user.radno_mjesto_id , dolazi: true, podaci: results3.rows[0], podredjeni: results4.rows})
                  } else if(results2.rows[0].odlazak !== null && results2.rows[0].odlazak !== undefined) {
                    res.render('dashboard',{ radnoMjestoID: req.user.radno_mjesto_id , dolazi: false, otisao: true, podaci: results3.rows[0], podredjeni: results4.rows})
                  } else {
                    res.render('dashboard',{ radnoMjestoID: req.user.radno_mjesto_id , dolazi: false, otisao: false, podaci: results3.rows[0], podredjeni: results4.rows})
                  }
                })

              }

                })

          })
        })

      }
  }
  else return res.redirect('/login')
});

module.exports = router;
