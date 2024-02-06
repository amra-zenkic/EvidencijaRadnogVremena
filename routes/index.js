var express = require('express');
const {pool} = require("../dbConfig");
const {response} = require("express");
var router = express.Router();
var nodemailer = require('nodemailer');
const PDFDocumentTable = require("pdfkit-table");
require("dotenv").config(); // za slanje mailova ovdje koristim


/* GET home page. */
router.get('/', async function(req, res, next) {
  // provjera da li je vec prijavljen ili ne, ako jeste ne smijemo ga pustiti da ide na ovu stranicu
  if(req.isAuthenticated()) {
      // ukoliko je admin saljemo ga na admin stranicu ukoliko nije onda na dashboard za sad
      if(req.user.radno_mjesto_id !== 1) {
        return res.redirect('/dashboard' )
      }
      else {
        return  res.redirect('/admin')
      }
  }
  else
    return res.redirect('/login')
});
router.post('/radno-vrijeme',  (req, res, next) => {
  if(req.isAuthenticated()) {
    if(req.body.radnoVrijeme === "1") { // zapocinjemo radno vrijeme
      pool.connect((err, client, done) => {
        client.query(
            `INSERT INTO evidencija_radnog_vremena (radnik_id, datum, dolazak) VALUES ($1, current_date, current_time)`,
            [req.user.id],
            (err, results2) => {
              done()
              if(err)
                throw err

              if(req.user.radno_mjesto_id === 1)
                return res.redirect('/admin')
              else
                return res.redirect('/dashboard')

            })
      })
    }
    else {
      pool.connect((err, client, done) => {
        client.query(`update evidencija_radnog_vremena 
                  set odlazak = current_time 
                  where radnik_id = $1 and datum = current_date`, [req.user.id], (err, results3) => {
          done()
          if(err)
            throw err

          if(req.user.radno_mjesto_id === 1)
            return res.redirect('/admin')
          else
            return res.redirect('/dashboard')

        })
      })
    }
  }
  else {
    return res.redirect('/login')
  }

})

router.get('/svi-projekti', async(req, res, next) => {
  if(req.isAuthenticated()) {
      // ukoliko je admin saljemo ga na admin stranicu ukoliko nije onda na dashboard za sad
      if(req.user.radno_mjesto_id === 1) { // generisemo sve projekte za svakog
        await pool.connect((err, client, done) => {
          client.query('select p.id, p.naziv_projekta,p.opis_projekta,p.status_projekta ,p.startni_datum,p.zavrsni_datum,u.name as ime_glavnog_menadzera,u.surname as prezime_glavnog_menadzera,u.email as email_glavnog_menadzera,p.ime_klijenta,p.klijent_email as email_klijenta from projekti p join users u on u.id = p.glavni_menadzer_id;', [], (err, results2) => {
            done()
            if (err)
              throw err
            return res.render('svi-projekti', {podaci: results2.rows, radnoMjestoID: req.user.radno_mjesto_id})
          })
        })
      }
      else {
        await pool.connect((err, client, done) => {
          client.query(`select
                            distinct(p.id),
                            p.naziv_projekta,
                            p.status_projekta,
                            p.opis_projekta,
                            p.startni_datum,
                            p.zavrsni_datum,
                            u.name as ime_glavnog_menadzera,
                            u.surname as prezime_glavnog_menadzera,
                            u.email as email_glavnog_menadzera,
                            p.ime_klijenta,
                            p.klijent_email as email_klijenta
                        from  projekti p
                            join projekti_i_radnici pr on pr.projekat_id = p.id
                            join users u2 on u2.id = pr.radnik_id
                            join users u on p.glavni_menadzer_id = u.id
                        where u2.id = $1 or p.glavni_menadzer_id = $2`, [req.user.id,req.user.id], (err, results3) => {
            done()
            if (err)
              throw err
            return res.render('svi-projekti', {podaci: results3.rows, radnoMjestoID: req.user.radno_mjesto_id})
          })
        })
      }

  }
  else
    return res.redirect('/login')
})
router.get('/svi-projekti/projekti-detaljno/:id', async (req, res, next) => {
  if(req.isAuthenticated()) {

    await pool.connect((err, client, done) => {
      client.query(`select
                      p.id,
                      p.naziv_projekta,
                      p.status_projekta,
                      p.opis_projekta,
                      p.ime_klijenta,
                      p.klijent_email,
                      p.startni_datum,
                      p.zavrsni_datum,
                      u2.id as id_glavnog_menadzera,
                      u2.name as ime_glavnog_menadzera,
                      u2.surname as prezime_glavnog_menadzera,
                      u.name as ime_radnika,
                      u.surname as prezime_radnika,
                      u.email as email_radnika,
                      t.naziv_tima
                  from projekti_i_radnici pr
                      join projekti p on p.id = pr.projekat_id
                      join users u on u.id = pr.radnik_id
                      join users u2 on u2.id = p.glavni_menadzer_id
                      join timovi t on t.id = pr.tim_id
                  where pr.projekat_id = $1`,
          [req.params.id], (err, results) => {
            if (err)
              throw err
            client.query(`select
                          sum(EXTRACT(EPOCH FROM potroseno_vrijeme_na_tasku) /3600) as potroseno_vrijeme
                      from taskovi
                      where projekat_id = $1;`, [req.params.id], (err, results3) => {

              if (err)
                throw err
              var porosenoVrijeme = results3.rows[0].potroseno_vrijeme
              if (porosenoVrijeme === undefined || porosenoVrijeme === null) {
                porosenoVrijeme = 0;
              }
              if (req.user.radno_mjesto_id === 3) {
                done()
                res.render('projekti-detaljno', {
                  podaci: results.rows,
                  radnoMjestoID: req.user.radno_mjesto_id, potrosenoVrijeme: porosenoVrijeme
                })
              } else {
                // trazimo dodatne informacije koje ce biti dostupne samo za admina i menadzera
                client.query(`select
                                concat(u.name, ' ', u.surname) as ime_radnika,
                                sum(EXTRACT(EPOCH FROM potroseno_vrijeme_na_tasku) /3600) as potroseno_vrijeme
                            from taskovi t
                            join users u on u.id = t.radnik_id
                            where t.projekat_id = $1
                            group by ime_radnika;`, [req.params.id], (err, results4) => {
                  if (err)
                    throw err
                  utrosenoVrijeme = results4.rows
                  for (let i = 0; i < utrosenoVrijeme.length; i++) {
                    if (utrosenoVrijeme[i].potroseno_vrijeme === undefined || utrosenoVrijeme[i].potroseno_vrijeme === null) {
                      utrosenoVrijeme[i].potroseno_vrijeme = 0
                    }
                  }
                  client.query(`select
                                    t.naziv_taska,
                                    t.opis_taska,
                                    concat(u.name, ' ', u.surname) as ime_i_prezime_radnika,
                                    t.potroseno_vrijeme_na_tasku,
                                    t.zavrsni_datum
                                from taskovi t
                                join users u on t.radnik_id = u.id
                                where t.projekat_id = $1;`, [req.params.id], (err, results5) => {
                    done()
                    if(err)
                      throw err
                    res.render('projekti-detaljno', {
                      podaci: results.rows,
                      radnoMjestoID: req.user.radno_mjesto_id,
                      potrosenoVrijeme: porosenoVrijeme,
                      utrosenoVrijemePoTasku: utrosenoVrijeme,
                      taskovi: results5.rows
                    })
                  })

                })

              }

            })

          })
    })
    }
    else
      return res.redirect('/login')
})
router.get('/dodaj-novi-projekat', async (req, res, next) => {
  let radnoMjestoKorisnika
  if(req.isAuthenticated()) {
      // ukoliko je admin ili menadzer dozvoljavamo dodavanje novog projekta
      radnoMjestoKorisnika = req.user.radno_mjesto_id
      if(req.user.radno_mjesto_id === 1 || req.user.radno_mjesto_id === 2) { // generisemo sve projekte za svakog
        await pool.connect((err, client, done) => {
          client.query('select * from users where radno_mjesto_id = 2;', [], (err, results2) => {
            client.query('select * from users where radno_mjesto_id != 1', [], (err, results3) => {
              if (err)
                throw err
              client.query('select * from timovi', [], (err, results4) => {
                done()
                if (err)
                  throw err
                res.render('dodaj-novi-projekat', {
                  menadzeri: results2.rows,
                  sviRadnici: results3.rows,
                  timovi: results4.rows,
                  radnoMjestoKorisnika: radnoMjestoKorisnika,
                  radnoMjestoID: req.user.radno_mjesto_id
                })
              })

            })

          })
        })
      }
      else {
        return res.redirect('/dashboard')
      }

  }
  else
    return res.redirect('/login')
})
router.post('/dodaj-novi-projekat/dodaj', async (req, res, next) => {
  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id === 3)
      return res.redirect('/dashboard')
    var zadnjiDodaniProjekatID;

    try {
      const client = await pool.connect();

      try {
        const result1 = await client.query('SELECT id FROM users WHERE email = $1', [req.body.glavni_menadzer]);

        const result2 = await client.query(
            'INSERT INTO projekti (naziv_projekta, opis_projekta, startni_datum, zavrsni_datum, glavni_menadzer_id, ime_klijenta, klijent_email) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [req.body.ime_projekta, req.body.opis_projekta, req.body.startni_datum, req.body.zavrsni_datum, result1.rows[0].id, req.body.ime_klijenta, req.body.email_klijenta]
        );

        zadnjiDodaniProjekatID = result2.rows[0].id;


        const radniciRadeUProjektu = req.body.radniciRadeUProjektu;

        const timoviID = req.body.timoviID;
        let i = 0;
        let j = 0
        if(Array.isArray(radniciRadeUProjektu)) {
          while (i < radniciRadeUProjektu.length) {
            while(timoviID[j] === '0') {
              j++
            }
            await client.query('INSERT INTO projekti_i_radnici (projekat_id, radnik_id, tim_id) VALUES ($1, $2, $3)',
                [zadnjiDodaniProjekatID, radniciRadeUProjektu[i], timoviID[j]]);
            i++
            j++
          }
        }
        else {
          while(timoviID[j] === '0') {
            j++
          }
          await client.query('INSERT INTO projekti_i_radnici (projekat_id, radnik_id, tim_id) VALUES ($1, $2, $3)',
              [zadnjiDodaniProjekatID, radniciRadeUProjektu, timoviID[j]]);
        }



        await client.query(`select
                              p.id,
                              concat(u.name, ' ', u.surname) as ime_i_prezime_menadzera,
                              u.email as email_menadzera,
                              concat(u2.name, ' ', u2.surname) as ime_i_prezime_radnika,
                              u2.email as email_radnika,
                              p.naziv_projekta,
                              p.opis_projekta,
                              p.startni_datum,
                              p.zavrsni_datum,
                              p.ime_klijenta,
                              p.klijent_email,
                              t.naziv_tima
                          from projekti_i_radnici pr
                          join projekti p on p.id = pr.projekat_id
                          join users u on u.id = p.glavni_menadzer_id
                          join users u2 on u2.id = pr.radnik_id
                          join timovi t on t.id = pr.tim_id
                          where pr.projekat_id = $1;`, [zadnjiDodaniProjekatID], (err, result3) => {
          if(err)
            throw err
          // svim radnicima i menadzeru ukljucenom u projekat saljemo mail koji ih obavještava o uključenju o projekat
          var transporter = nodemailer.createTransport({
            service: 'outlook',
            auth: {
              user: 'amrazenkic21@gmail.com',
              pass: process.env.SIFRA
            }
          });
          let formatiranHtml = `<h1>Uključeni ste na novi projekat</h1>
                                    <h3>${result3.rows[0].naziv_projekta}</h3>
                                    <p><b>Opis projekta:</b> ${result3.rows[0].opis_projekta}</p>
                                    <p>Ime glavnog menadžera: ${result3.rows[0].ime_i_prezime_menadzera}</p>
                                    <p>Startni datum: ${result3.rows[0].startni_datum}</p>
                                    <p>Završni datum: ${result3.rows[0].zavrsni_datum}</p>
                                    <p>Ime klijenta: ${result3.rows[0].ime_klijenta}</p>
                                    <p>Email klijenta: ${result3.rows[0].klijent_email}</p>
                                    <h2>Radnici na projektu</h2>
                                    <table border='1'><thead><tr><th>Ime i prezime</th><th>Email</th><th>Tim</th></tr></thead><tbody>`
          for(let i = 0; i<result3.rows.length; i++) {
            formatiranHtml += `<tr><td>${result3.rows[i].ime_i_prezime_radnika}</td><td>${result3.rows[i].email_radnika}</td><td>${result3.rows[i].naziv_tima}</td></tr>`;
          }
          formatiranHtml += "</tbody></table>";


          var stringMailova = ''
          stringMailova += result3.rows[0].email_menadzera
          for(let i = 0; i<result3.rows.length; i++) {
            stringMailova += ', '
            stringMailova += result3.rows[i].email_radnika
          }
          var mailOptions = {
            from: 'amrazenkic21@gmail.com',
            to: stringMailova,
            subject: 'Obavjestenje o projektu',
            html: formatiranHtml
          };

          transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
              console.log(error);
            } else {
              console.log('Email sent: ' + info.response);
            }
          });

        })
        res.redirect('/svi-projekti');
      } finally {
        client.release(); // Release the connection back to the pool
      }
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  }
});
router.get('/aktivni-projekti', async (req, res, next) => {
  if(req.isAuthenticated()) {
    await pool.connect((err, client, done) => {
      if (req.user.radno_mjesto_id === 1) { // ima pristup svim aktivnim projektima
        // generisemo sve aktivne projekte
        client.query('select p.id, p.naziv_projekta,p.opis_projekta,p.status_projekta ,p.startni_datum,p.zavrsni_datum,u.name as ime_glavnog_menadzera,u.surname as prezime_glavnog_menadzera,u.email as email_glavnog_menadzera,p.ime_klijenta,p.klijent_email as email_klijenta from projekti p join users u on u.id = p.glavni_menadzer_id WHERE p.status_projekta is null;', [], (err, results2) => {
          done()
          if (err)
            throw err

          return res.render('svi-projekti', {podaci: results2.rows, radnoMjestoID: req.user.radno_mjesto_id})
        })
      } else {
        client.query(`select
                        distinct(p.id),
                        p.naziv_projekta,
                        p.opis_projekta,
                        p.status_projekta ,
                        p.startni_datum,
                        p.zavrsni_datum,
                        u2.name as ime_glavnog_menadzera,
                        u2.surname as prezime_glavnog_menadzera,
                        u2.email as email_glavnog_menadzera,
                        p.ime_klijenta,
                        p.klijent_email as email_klijenta
                    from projekti p
                        join projekti_i_radnici pr on pr.projekat_id = p.id
                        join users u on u.id = pr.radnik_id
                        join users u2 on u2.id = p.glavni_menadzer_id
                    WHERE p.status_projekta is null and
                          ((u.id = $1 and
                          u.id in (select radnik_id
                                   from projekti_i_radnici
                                   where projekat_id = p.id))
                          or u2.id = $2);`, [req.user.id, req.user.id], (err, results2) => {
          done()
          if (err)
            throw err

          return res.render('svi-projekti', {podaci: results2.rows, radnoMjestoID: req.user.radno_mjesto_id})
        })

      }

    })
  }
  else
    return res.redirect('/login')
})
router.get('/zavrseni-projekti', async (req, res, next) => {
  if(req.isAuthenticated()) {
      if(req.user.radno_mjesto_id === 1) { // ima pristup svim zavrsenim projektima
        // generisemo sve zavrsene projekte
        pool.connect((err, client, done) => {
          client.query('select p.id, p.naziv_projekta,p.opis_projekta,p.status_projekta ,p.startni_datum,p.zavrsni_datum,u.name as ime_glavnog_menadzera,u.surname as prezime_glavnog_menadzera,u.email as email_glavnog_menadzera,p.ime_klijenta,p.klijent_email as email_klijenta from projekti p join users u on u.id = p.glavni_menadzer_id WHERE p.status_projekta is not null;', [], (err, results2)=> {
            done()
            if(err)
              throw err

            return res.render('svi-projekti', { podaci: results2.rows, radnoMjestoID: req.user.radno_mjesto_id })
          })
        })
      }
      else {
        pool.connect((err, client, done) => {
          client.query(`select
                        distinct(p.id),
                        p.naziv_projekta,
                        p.opis_projekta,
                        p.status_projekta ,
                        p.startni_datum,
                        p.zavrsni_datum,
                        u2.name as ime_glavnog_menadzera,
                        u2.surname as prezime_glavnog_menadzera,
                        u2.email as email_glavnog_menadzera,
                        p.ime_klijenta,
                        p.klijent_email as email_klijenta
                    from projekti p
                        join projekti_i_radnici pr on pr.projekat_id = p.id
                        join users u on u.id = pr.radnik_id
                        join users u2 on u2.id = p.glavni_menadzer_id
                    WHERE p.status_projekta is not null and
                          ((u.id = $1 and
                          u.id in (select radnik_id
                                   from projekti_i_radnici
                                   where projekat_id = p.id))
                          or u2.id = $2);`, [req.user.id, req.user.id], (err, results2)=> {
            done()
            if(err)
              throw err

            return res.render('svi-projekti', { podaci: results2.rows, radnoMjestoID: req.user.radno_mjesto_id })
        })
        })

      }
  }
  else
    return res.redirect('/login')
})

router.post('/zavrsi-projekat', async (req, res, next) => {
  if (req.isAuthenticated()) {
    if (req.user.radno_mjesto_id === 1 || req.user.radno_mjesto_id === 2) {
      // mozemo oznaciti projekat kao zavrsen
      pool.connect((err, client, done) => {
        if (err) {
          done();
          throw err;
        }

        client.query('UPDATE projekti SET status_projekta = true WHERE id = $1', [req.body.projekatID], (err, results) => {
          done();

          if (err) {
            throw err;
          }

          if (req.user.radno_mjesto_id === 1) {
            return res.redirect('/admin');
          } else {
            return res.redirect('/dashboard');
          }
        });
      });
    } else {
      return res.redirect('/dashboard');
    }
  } else {
    return res.redirect('/login');
  }
});


router.get('/dodaj-novi-task', async (req, res, next) => {
  if(req.isAuthenticated()) {
      // ukoliko je admin saljemo ga na admin stranicu ukoliko nije onda na dashboard za sad
      if(req.user.radno_mjesto_id === 3) {
        return res.redirect('/dashboard')
      }
      else if(req.user.radno_mjesto_id === 1) {
        return  res.redirect('/admin')
      }
      else { // imamo menadzera
        pool.connect((err, client, done) => {
          client.query('SELECT * FROM timovi',[], (err, timovi) => { // uzimamo sve timove
            if(err)
              throw  err
            // uzimamo sve projekte gdje je glavni menadzer
            client.query('SELECT * FROM projekti where glavni_menadzer_id = $1 and status_projekta is null',
                [req.user.id], (err, projekti) => {
              done()
                  if(err)
                    throw err
                  res.render('dodaj-novi-task', {timovi: timovi.rows, projekti: projekti.rows, radnoMjestoID: req.user.radno_mjesto_id})
                })
          })
        })
      }
  }
  else
    return res.redirect('/login')
})
router.get('/dohvati-podatke',async (req, res, next) => {
  var projekatID = req.query.projekat
  var timID = req.query.tim
  pool.connect((err, client, done) => {
    client.query(`
    select u.id, u.name, u.surname
    from projekti_i_radnici pr
    join projekti p on p.id = pr.projekat_id
    join users u on u.id = pr.radnik_id
    where pr.projekat_id = $1 and tim_id = $2;`, [projekatID, timID], (err, results) => {
      done()
      if(err)
        throw err
      var data_arr = []
      results.rows.forEach(function (row) {
        data_arr.push(row)
      })
      res.json(data_arr)
    })
  })
})
router.post('/dodaj-novi-task/dodaj', (req, res, next) => {
  if(req.isAuthenticated()) {
    pool.connect((err, client, done) => {
      client.query(`INSERT INTO taskovi (naziv_taska, opis_taska, projekat_id, radnik_id, zavrsni_datum) VALUES
            ($1, $2, $3, $4, $5) returning naziv_taska, opis_taska, zavrsni_datum`, [req.body.naziv_taska, req.body.opis_taska, req.body.projekat, req.body.radnik, req.body.zavrsni_datum], (err, results) => {

        if(err)
          throw err

        // saljemo radniku na mail da je dobio novi task
        client.query('select email from users where id = $1', [req.body.radnik], (err, results2) => {
          done()
          if(err)
            throw err

          var transporter = nodemailer.createTransport({
            service: 'outlook',
            auth: {
              user: 'amrazenkic21@gmail.com',
              pass: process.env.SIFRA
            }
          });
          let formatiranHtml = `<h1>Dobili ste novi task</h1><p>Naziv taska: ${results.rows[0].naziv_taska}</p>
                                    <p>Opis taska: ${results.rows[0].opis_taska}</p>
                                    <p>Završni datum: ${results.rows[0].zavrsni_datum}</p>`

          var mailOptions = {
            from: 'amrazenkic21@gmail.com',
            to: results2.rows[0].email,
            subject: 'Obavjestenje o novom tasku',
            html: formatiranHtml
          };

          transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
              console.log(error);
            } else {
              console.log('Email sent: ' + info.response);
            }
          });
        })
        res.redirect('/dodaj-novi-task')
      })
    })
  }
})

router.get('/moji-aktivni-taskovi', async (req, res, next) => {
  if(req.isAuthenticated()) {
      // ukoliko je admin saljemo ga na admin stranicu ukoliko nije ispisujemo aktivne taskove
      if(req.user.radno_mjesto_id === 2 || req.user.radno_mjesto_id === 3) {
        pool.query(`select
                      p.naziv_projekta,
                      p.ime_klijenta,
                      t.id,
                      t.naziv_taska,
                      t.opis_taska,
                      t.zavrsni_datum,
                      concat(u.name , ' ' , u.surname) as ime_menadzera,
                      concat(u2.name, ' ', u2.surname) as naziv_radnika
                  from taskovi t
                  join projekti p on p.id = t.projekat_id
                  join users u on u.id = p.glavni_menadzer_id
                  join users u2 on u2.id = t.radnik_id
                  where t.potroseno_vrijeme_na_tasku is null
                  and t.radnik_id = $1
                  order by t.zavrsni_datum;`, [req.user.id], (err, results2) => {
            if(err)
              throw err
            res.render('taskovi', { taskovi: results2.rows, radnoMjestoID: req.user.radno_mjesto_id
                                                , radnikID: req.user.id, aktivniTaskovi: true, brojTaskovaKojiKasne: "Polje dostupno samo za menadžere i zadane projekte"})
        })
      }
      else if(req.user.radno_mjesto_id === 1){
        return  res.redirect('/admin')
      }
      else {
        return res.redirect('/dashboard')
      }

  }
  else
    return res.redirect('/login')
})

router.post('/zavrsi-task/:taskID/:radnikID', (req, res, next) => {
  if(req.isAuthenticated()) {
    pool.connect((err, client, done) => {
      client.query('UPDATE taskovi SET potroseno_vrijeme_na_tasku = $1 WHERE id = $2',
          [`${req.body.brSati} hours`, req.params.taskID], (err, response) => {
            done()
            if(err)
              throw err
            return res.redirect('/moji-aktivni-taskovi')
          })
    })
  }
})
router.get('/zavrsi-task-brzo', async (req, res, next) => {
  if(req.isAuthenticated()) {
    var podjeljen = req.query.gotovTask.split('#')

    if(podjeljen.length !== 4) {
      req.flash('success_msg', "Neispravan unos!")
      return res.redirect('/moji-aktivni-taskovi')
    }
    for(let i = 0; i<podjeljen.length; i++) {
      podjeljen[i] = podjeljen[i].trim()
    }
    podjeljen[3] = podjeljen[3].match(/\d+/)[0]


    await pool.connect((err, client, done) => {
      client.query(`select
                      t.id as task_id,
                      p.id as projekat_id
                  from taskovi t
                  join projekti p on p.id = t.projekat_id
                  where t.radnik_id = $1 and
                        t.potroseno_vrijeme_na_tasku is null and
                        p.naziv_projekta ilike $2 and
                        t.naziv_taska ilike $3;`, [req.user.id, podjeljen[1], podjeljen[2]], (err, result) => {
        if(err)
          throw err

        if(result.rows.length == 0) {
          done()
          req.flash('success_msg', "Nepostojeći projekat/task!")
          return res.redirect('/moji-aktivni-taskovi')

        }
        client.query('UPDATE taskovi SET potroseno_vrijeme_na_tasku = $1 WHERE id = $2',
            [`${podjeljen[3]} hours`, result.rows[0].task_id], (err, response) => {
              done()
              if(err)
                throw err
              req.flash('success_msg', "Uspješno završen task!")
              return res.redirect('/moji-aktivni-taskovi')
            })

      })
    })
  }
})

router.get('/moji-zavrseni-taskovi', async (req, res, next) => {
  if(req.isAuthenticated()) {

      // ukoliko je admin saljemo ga na admin stranicu ukoliko nije onda na dashboard za sad
      if(req.user.radno_mjesto_id === 2 || req.user.radno_mjesto_id === 3) {
        pool.connect((err, client, done) => {
          client.query(`select
                      p.naziv_projekta,
                      p.ime_klijenta,
                      t.id,
                      t.naziv_taska,
                      t.opis_taska,
                      t.zavrsni_datum,
                      concat(u.name , ' ' , u.surname) as ime_menadzera,
                      concat(u2.name, ' ', u2.surname) as naziv_radnika
                  from taskovi t
                  join projekti p on p.id = t.projekat_id
                  join users u on u.id = p.glavni_menadzer_id
                  join users u2 on u2.id = t.radnik_id
                  where t.potroseno_vrijeme_na_tasku is not null
                  and t.radnik_id = $1
                  order by t.zavrsni_datum;`, [req.user.id], (err, results2) => {
            done()
            if(err)
              throw err
            res.render('taskovi', { taskovi: results2.rows, radnoMjestoID: req.user.radno_mjesto_id
              , radnikID: req.user.id, aktivniTaskovi: false})
          })
        })
      }
      else if(req.user.radno_mjesto_id === 1){
        return  res.redirect('/admin')
      }
      else {
        return res.redirect('/dashboard')
      }
  }
  else
    return res.redirect('/login')
})

router.get('/zadani-aktivni-taskovi', async (req, res, next) => {
  if(req.isAuthenticated()) {
      // ukoliko je admin saljemo ga na admin stranicu ukoliko nije onda na dashboard za sad
      if(req.user.radno_mjesto_id === 2) {
          await pool.connect((err, client, done) => {
            client.query(`select
                          p.naziv_projekta,
                          p.ime_klijenta,
                          t.id,
                          t.naziv_taska,
                          t.opis_taska,
                          t.zavrsni_datum,
                          concat(u2.name, ' ', u2.surname) as naziv_radnika,
                          concat(u.name, ' ', u.surname) as ime_menazera,
                          t.potroseno_vrijeme_na_tasku,
                          coalesce((select
                              count(*)
                          from taskovi t1
                          join projekti p1 on p1.id = t1.projekat_id
                          where t1.zavrsni_datum < current_date and p1.glavni_menadzer_id = $2 and t1.potroseno_vrijeme_na_tasku is null), 0) as broj_taskova_koji_kasne
                      from projekti p
                      join users u on u.id = p.glavni_menadzer_id
                      join taskovi t on t.projekat_id = p.id
                      join users u2 on u2.id = t.radnik_id
                      where u.id = $1 and 
                    t.potroseno_vrijeme_na_tasku is null;`,
                [req.user.id, req.user.id], (err, results2) => {
                  done()
                  if (err)
                    throw err
                  let brojTaskovaKojiKasne = 0
                  if(results2.rows.length > 0)
                    brojTaskovaKojiKasne = results2.rows[0].broj_taskova_koji_kasne
                  res.render('taskovi', {
                    taskovi: results2.rows,
                    radnoMjestoID: req.user.radno_mjesto_id,
                    radnikID: req.user.id,
                    aktivniTaskovi: true,
                    brojTaskovaKojiKasne: brojTaskovaKojiKasne
                  })
                })
          })
      }
      else if(req.user.radno_mjesto_id === 1){
        return  res.redirect('/admin')
      }
      else {
        return res.redirect('/dashboard')
      }

  }
  else
    return res.redirect('/login')
})

router.get('/zadani-zavrseni-taskovi', async (req, res, next) => {
  if(req.isAuthenticated()) {
      // ukoliko je admin saljemo ga na admin stranicu ukoliko nije onda na dashboard za sad
      if(req.user.radno_mjesto_id === 2) {

        await pool.connect((err, client, done) => {
          client.query(`select
                          p.naziv_projekta,
                          p.ime_klijenta,
                          t.id,
                          t.naziv_taska,
                          t.opis_taska,
                          t.zavrsni_datum,
                          concat(u2.name, ' ', u2.surname) as naziv_radnika,
                          concat(u.name, ' ', u.surname) as ime_menadzera,
                          t.potroseno_vrijeme_na_tasku
                      from projekti p
                      join users u on u.id = p.glavni_menadzer_id
                      join taskovi t on t.projekat_id = p.id
                      join users u2 on u2.id = t.radnik_id
                      where u.id = $1 and 
                    t.potroseno_vrijeme_na_tasku is not null;`,
              [req.user.id], (err, results2) => {
                done()
                if (err)
                  throw err
                res.render('taskovi', {
                  taskovi: results2.rows, radnoMjestoID: req.user.radno_mjesto_id
                  , radnikID: req.user.id, aktivniTaskovi: false
                })
              })
        })
      }
      else if(req.user.radno_mjesto_id === 1){
        return  res.redirect('/admin')
      }
      else {
        return res.redirect('/dashboard')
      }
  }
  else
    return res.redirect('/login')
})

router.get('/chat', (req, res, next) => {

  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id !== 1) { // necemo da admin moze da salje poruke, on neka se javi preko maila :)
      pool.connect((err, client, done) => {
        client.query(`SELECT * FROM users WHERE id != $1 and radno_mjesto_id != 1`, [req.user.id], (err, results) => {
          done()

          res.render('chat', {podaci: results.rows, radnoMjestoID: req.user.radno_mjesto_id, poruke: [], komeSeSalje: -1})
        })

      })
    }
    else {
      return res.redirect('/admin')
    }
  }
  else
    return res.redirect('/login')
})
router.get('/chat/:id', (req, res, next) => {
  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id !== 1) { // necemo da admin moze da salje poruke, on neka se javi preko maila :)
      pool.connect((err, client, done) => {
        client.query(`SELECT
                      p.poslao_id,
                      p.primio_id,
                      p.vrijeme,
                      p.poruka,
                      concat(u.name, ' ', u.surname) as poslao_ime,
                      concat(u2.name, ' ', u2.surname) as primio_ime
                  FROM poruke p
                  join users u on u.id = p.poslao_id
                  join users u2 on u2.id = p.primio_id
                  WHERE p.primio_id in ($1, $2) and p.poslao_id in ($3, $4)
                  ORDER BY vrijeme;`, [req.user.id, req.params.id,req.user.id, req.params.id], (err, results) => {
          client.query(`SELECT * FROM users WHERE id != $1 and radno_mjesto_id != 1`, [req.user.id], (err, results2) => {
            done()
            if(err)
              throw err
            res.render('chat', {podaci: results2.rows, radnoMjestoID: req.user.radno_mjesto_id, poruke: results.rows, komeSeSalje: req.params.id})
          })

        })
      })
    }
    else {
      return res.redirect('/admin')
    }
  }
  else
    return res.redirect('/login')

})
router.post('/posalji-poruku', (req, res, next) => {
  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id !== 1) { // necemo da admin moze da salje poruke, on neka se javi preko maila :)
      pool.connect((err, client, done) => {
        client.query(`insert into poruke (poslao_id, primio_id, poruka) values 
                    ($1, $2, $3);`, [req.user.id, req.body.komeSeSalje, req.body.poruka], (err, results) => {
          done()


        })

      })
      return res.redirect(`/chat/${req.body.komeSeSalje}`)
    }
    else {
      return res.redirect('/admin')
    }
  }
  else
    return res.redirect('/login')
})

router.get('/radni-sati-po-projektu', async (req, res, next) => {
  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id == 1) { // uzimamo sve projekte za admina
      await pool.connect((err, client, done) => {
        client.query(`select
                      p.id,
                      p.naziv_projekta,
                      p.ime_klijenta,
                      p.klijent_email,
                      sum(t.potroseno_vrijeme_na_tasku) as ukupno_vrijeme
                  from taskovi t
                  right join projekti p on p.id = t.projekat_id
                  group by p.id,
                      p.naziv_projekta,
                      p.ime_klijenta,
                      p.klijent_email;`, (err, results) => {
          done()
          if(err)
            throw err
          res.render('radni-sati', {title: "Radni sati po projektu",
            podaci: results.rows, radnoMjestoID: req.user.radno_mjesto_id})
        })
      })
    }
    else if(req.user.radno_mjesto_id == 2){
      await pool.connect((err, client, done) => {
        client.query(`select
                          p.id,
                          p.naziv_projekta,
                          p.ime_klijenta,
                          p.klijent_email,
                          sum(t.potroseno_vrijeme_na_tasku) as ukupno_vrijeme
                      from taskovi t
                      right join projekti p on p.id = t.projekat_id
                      where p.glavni_menadzer_id = $1
                      group by p.id,
                          p.naziv_projekta,
                          p.ime_klijenta,
                          p.klijent_email;`, [req.user.id], (err, results) => {
          done()
          if(err)
            throw err
          res.render('radni-sati', {title: "Radni sati po projektu",
            podaci: results.rows, radnoMjestoID: req.user.radno_mjesto_id})
        })
      })
    }
    else
      return res.redirect('/dashboard')
  }
  else
    return res.redirect('/login')
})
router.get('/radni-sati-po-radniku', (req, res, next) => {
  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id == 1) { // uzimamo sve projekte za admina
      pool.connect((err, client, done) => {
        client.query(`select
                          id,
                          concat(name, ' ', surname) as ime_i_prezime_radnika,
                          email
                      from users
                      where radno_mjesto_id != 1;`, (err, results) => {
          done()
          if(err)
            throw err
          res.render('radni-sati-radnici', {podaci: results.rows, radnoMjestoID: req.user.id})
        })
      })
    }
    else
      return res.redirect('/dashboard')
  }
  else
    return res.redirect('/login')
})
router.get('/radni-sati-po-ovom-radniku', (req, res, next) => {

  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id == 1) { // uzimamo sve projekte za admina
      pool.connect((err, client, done) => {
        client.query(`select
                        concat(name, ' ', surname) as ime_i_prezime_radnika
                      from users where id = $1`, [req.query.radnik], (err, results1) => {
          if(err)
            throw err
          client.query(`select
                        distinct(p.id),
                        p.naziv_projekta,
                        p.ime_klijenta,
                        p.klijent_email,
                        (select sum(potroseno_vrijeme_na_tasku)
                         from taskovi
                         where radnik_id = u.id and projekat_id = p.id) as ukupno_vrijeme
                  from projekti_i_radnici pr
                  join users u on u.id = pr.radnik_id
                  join projekti p on p.id = pr.projekat_id
                  join taskovi t on t.radnik_id = u.id
                  where u.id = $1;`, [req.query.radnik], (err, results) => {
            done()
            if(err)
              throw err
            res.render('radni-sati', {title: "Radni sati po radniku " + results1.rows[0].ime_i_prezime_radnika,
              podaci: results.rows, radnoMjestoID: req.user.radno_mjesto_id})
          })
        })

      })
    }
    else
      return res.redirect('/dashboard')
  }
  else
    return res.redirect('/login')
})
router.post('/pdf-radni-sati-po-projektu', async (req, res, next) => {
  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id === 3)
      res.redirect('/dashboard')
    const doc = new PDFDocumentTable();
    const podaci = JSON.parse(req.body.podaci)
    // https://www.npmjs.com/package/pdfkit-table  dokumentacija

    var redoviTabele = []
    for(let i = 0; i<podaci.length; i++) {
      let niz = [
        podaci[i].naziv_projekta,
        podaci[i].ime_klijenta,
        podaci[i].klijent_email,
      ]
      if(podaci[i].ukupno_vrijeme == null)
        niz.push(0)
      else niz.push(podaci[i].ukupno_vrijeme.hours)
      redoviTabele.push(niz)
    }

    // table
    const table = {
      title: "Izvještaj",
      headers: [ "Naziv projekta", "Ime klijenta", "Email klijenta", "Ukupno vrijeme (u satima)"],
      rows:
      redoviTabele
      ,
    };

    await doc.table(table, {
      prepareHeader: () => doc.font('public/Noto_Sans/static/NotoSans_ExtraCondensed-Regular.ttf').fontSize(8),
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        doc.font('public/Noto_Sans/static/NotoSans_ExtraCondensed-Regular.ttf').fontSize(8);

      },
    });

    doc.end();

    res.setHeader('Content-Disposition', 'attachment; filename=izvjestaj.pdf');
    res.setHeader('Content-Type', 'application/pdf');


    doc.pipe(res);
  }
  else {
    return res.redirect('/login')
  }

})

module.exports = router;
