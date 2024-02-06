var express = require('express');
var router = express.Router();
const {pool} = require("../dbConfig");
const bcrypt = require("bcrypt");
var nodemailer = require('nodemailer');
require("dotenv").config(); // za slanje mailova ovdje koristim

const PDFDocument = require('pdfkit')
const PDFDocumentTable = require("pdfkit-table");
const fs = require('fs')

/* GET home page. */
router.get('/', async function(req, res, next) {
  // provjeravamo da li administrator pokusava da pristupi podacima
  if(req.isAuthenticated()) {
    const results = await pool.query('SELECT radno_mjesto_id FROM users WHERE email = $1', [req.user.email])
    if(results.rows[0].radno_mjesto_id !== 1) {
      return res.redirect('/dashboard')
    }
    else {
      pool.connect((err, client, done) => {
        client.query('SELECT count(*) as br FROM users', [], (err, brojRadnika) => {
          if(err)
            throw err
          client.query('SELECT count(*) as br FROM users WHERE radno_mjesto_id = 2', [], (err, brojMenadzera) => {
            if(err)
              throw err
            client.query('select count(*) as br from projekti where status_projekta is null;', [], (err, brojNezavrsenihProjekata) => {
              if(err)
                throw err
              client.query('select count(*) as br from projekti where status_projekta is not null;', [], (err, brojZavrsenihProjekata) => {
                if(err)
                  throw err
                client.query('select naziv_tima from timovi;', [], (err, timovi) => {
                  done()
                  if(err)
                    throw err
                  res.render('admin', { brojRadnika: brojRadnika.rows[0].br, brojMenadzera: brojMenadzera.rows[0].br,
                    brojNezavrsenihProjekata: brojNezavrsenihProjekata.rows[0].br,
                    brojZavrsenihProjekata: brojZavrsenihProjekata.rows[0].br, timovi: timovi.rows, radnoMjestoID: results.rows[0].radno_mjesto_id});
                })

              })
            })
          })
        })

      })



    }

  }
  else {
    return res.redirect('/')
  }

});

router.get('/svi-korisnici',async (req, res, next)=>{
  // provjeravamo da li administrator pokusava da pristupi podacima
  // konekcija se sama zatvara
  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id !== 1)
      return res.redirect('/dashboard')
    else {
      // sve je ok, podacima pokusava da pristupi admin pa ga saljemo:
      await pool.connect((err, client, done) => {
        client.query(`select u.id, u.name, u.surname, u.email, concat(u2.name, ' ', u2.surname) as nadredjeni, u2.email as nadredjeni_email, r.naziv_radnog_mjesta from users u left outer join radna_mjesta r on r.id = u.radno_mjesto_id left outer join users u2 on u2.id = u.nadredjeni_id;`,
            (err, results) => {
              done()
              if (err)
                throw err
              res.render('svi-korisnici', {podaci: results.rows, radnoMjestoID: req.user.radno_mjesto_id})
            })
      })
    }
  }
  else res.redirect('/login')
})
router.get('/produktivnost-korisnika/:id', async (req, res, next) => {
  // adminu dozvoljavamo da vidi za svakog radnika njegovu produktivnost:
  // u koje je projekte ukljucen, koje taskove ima, koliko vremena je potrosio na projektu
  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id !== 1)
      return res.redirect('/dashboard')
    else {
      // sve je ok, podacima pokusava da pristupi admin pa ga saljemo:
      await pool.connect((err, client, done) => {
        // prvo uzimamo sve podatke o radniku
        client.query(`select
                          concat(u.name, ' ', u.surname) as ime_i_prezime_radnika,
                          u.email,
                          r.naziv_radnog_mjesta,
                          concat(u2.name, ' ', u2.surname) as ime_i_prezime_nadredjenog,
                          u.radno_vrijeme_start,
                          u.radno_vrijeme_end
                      from users u
                      left outer join users u2 on u2.id = u.nadredjeni_id
                      join radna_mjesta r on r.id = u.radno_mjesto_id
                      where u.id = $1;`, [req.params.id], (err, results) => {
          if(err)
            throw err
          // uzimamo sve projekte u kojima je uključen
          client.query(`select
                            p.naziv_projekta,
                            p.startni_datum,
                            p.zavrsni_datum,
                            coalesce(p.status_projekta, false) as status_projekta
                        from projekti_i_radnici pr
                        join projekti p on p.id = pr.projekat_id
                        where pr.radnik_id = $1`, [req.params.id], (err, results2) => {
            if(err)
              throw err
            // uzimamo sve taskove
            client.query(`select
                              t.radnik_id,
                              t.naziv_taska,
                              t.opis_taska,
                              p.naziv_projekta,
                              t.potroseno_vrijeme_na_tasku,
                              t.zavrsni_datum
                          from taskovi t
                          join projekti p on p.id = t.projekat_id
                          where t.radnik_id = $1;`, [req.params.id], (err, results3) => {
              done()
              if(err)
                throw err
              res.render('produktivnost-radnika', {podaci: results.rows[0], projekti: results2.rows, taskovi: results3.rows, radnoMjestoID: req.user.radno_mjesto_id})
            })
          })

        })
      })
    }
  }
  else res.redirect('/login')
})
router.get('/svi-menadzeri', async (req, res, next) => {
  // provjeravamo da li administrator pokusava da pristupi podacima
  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id !== 1)
      return res.redirect('/dashboard')
    else {
      // sve je ok, podacima pokusava da pristupi admin pa ga saljemo:
      await pool.connect((err, client, done) => {
        client.query('select u.id, u.name, u.surname, u.email, u2.name as nadredjeni, u2.email as nadredjeni_email, r.naziv_radnog_mjesta from users u left outer join radna_mjesta r on r.id = u.radno_mjesto_id left outer join users u2 on u2.id = u.nadredjeni_id where u.radno_mjesto_id = 2;',
            (err, results)=> {
              done()
              if(err)
                throw err
              res.render('svi-korisnici', {podaci: results.rows, radnoMjestoID: req.user.radno_mjesto_id})
            })
      })
    }
  }
  else res.redirect('/login')
})

router.get('/dodaj-novog-korisnika', async (req, res, next)=> {
  // provjeravamo da li administrator pokusava da pristupi podacima
  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id !== 1)
      return res.redirect('/dashboard')

  // uzimanje svih mogucih radnih mjesta

    await pool.connect((err, client, done) => {
      client.query('SELECT * FROM radna_mjesta', [], (err, radnaMjesta) => {
        if (err)
          throw err
        client.query('SELECT * FROM users', [], (err, sviNadredjeni) => {
          done()
          if (err)
            throw err
          res.render('dodaj-novog-korisnika', {radnaMjesta: radnaMjesta.rows, sviNadredjeni: sviNadredjeni.rows, radnoMjestoID: req.user.radno_mjesto_id})

        })
      })
    })
    }
    else return res.redirect('/login')
})

router.post('/dodaj-novog-korisnika/dodaj', async (req, res, next) => {
  let { name, surname, email, password, password2, radno_mjesto, nadredjeni } = req.body;
  const radnaMjesta = await pool.query('SELECT * FROM radna_mjesta')
  const sviNadredjeni = await  pool.query('SELECT * FROM users')

  const idRadnogMjesta = await pool.query('SELECT id FROM radna_mjesta where naziv_radnog_mjesta LIKE $1', [req.body.radno_mjesto])

  radno_mjesto = idRadnogMjesta.rows[0].id

  if(nadredjeni === '') {
    nadredjeni = null
  }
  else {
    const idNadredjenog = await pool.query('SELECT id FROM users WHERE email LIKE $1', [req.body.nadredjeni])
    nadredjeni = idNadredjenog.rows[0].id
  }


  let errors = []; // ovo cemo koristiti za validaciju forme
  // provjera da li su sva polja unutar forme popunjena tj da li su ispravno popunjena
  if(!name || !email || !password || !password2) {
    errors.push({message: "Unesite sva polja"}) // u ovaj gore niz stavljamo ovu error poruku
  }
  if(password.length < 4 ) {
    errors.push({message: "Šifra mora bit dugačka bar 4 znaka"})
  }
  if(password !== password2) {
    errors.push({message: "Šifre se ne poklapaju"})
  }
  if(errors.length > 0) {
    res.render('/dodaj-novog-korisnika', { errors , radnaMjesta: radnaMjesta.rows, sviNadredjeni: sviNadredjeni.rows, radnoMjestoID: req.user.radno_mjesto_id })
  } else{
    // form validation je prosla
    let hashedPassword = await bcrypt.hash(password, 10);

    // provjeravamo da li korisnik vec postoji u bazi
    await pool.connect((err, client, done) => {
      client.query(
          'SELECT * FROM users WHERE email = $1', [email], (err, results)=> {
            if(err) {
              throw err
            }

            if((results.rows).length > 0) {
              errors.push({message: "The user already exists"})
              res.render('dodaj-novog-korisnika', { errors, radnaMjesta: radnaMjesta.rows, sviNadredjeni: sviNadredjeni.rows, radnoMjestoID: req.user.radno_mjesto_id })
            } else{
              // nema postojeceg user-a sa ovim emailom pa ga treba dodati u bazu

              client.query(
                  'INSERT INTO users (name, surname, email, password, radno_mjesto_id, nadredjeni_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, password',
                  [name, surname, email, hashedPassword, radno_mjesto, nadredjeni], (err, results) => {
                    done()
                    if(err) {
                      throw err
                    }

                    var uspjeh = []
                    uspjeh.push("Uspješno ste dodali korisnika")
                    res.render('dodaj-novog-korisnika', { uspjeh,  radnaMjesta: radnaMjesta.rows, sviNadredjeni: sviNadredjeni.rows, radnoMjestoID: req.user.radno_mjesto_id  })
                  }
              )
            }
          }
      )
    })

  }

})


router.get('/brisi-korisnika/:id', async function (req, res, next) {
    if(req.isAuthenticated()) {
      if(req.user.radno_mjesto_id !== 1)
        return res.redirect('/dashboard')
      else {
        await pool.connect((err, client, done) => {
          client.query('DELETE FROM users WHERE id = $1', [req.params.id], (err, result) => {
            done()
            if (err)
              throw err
            res.redirect('/admin/svi-korisnici')
          })
        })
      }
    }
    else {
      return res.redirect('/login')
    }
})
router.get('/izbrisi-projekat/:id', async function (req, res, next) {
  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id !== 1)
      return res.redirect('/dashboard')
    else {
      await pool.connect((err, client, done) => {
        client.query(`DELETE 
                      FROM projekti_i_radnici 
                      WHERE projekat_id = $1`, [req.params.id], (err, result) => {
          if (err)
            throw err
          client.query(`DELETE 
                      FROM taskovi 
                      WHERE projekat_id = $1`, [req.params.id], (err, result) => {
            if(err)
              throw err
            client.query(`DELETE 
                      FROM projekti 
                      WHERE id = $1`, [req.params.id], (err, result) => {
              done()
              if(err)
                throw err
              res.redirect('/svi-projekti')
            })

          })

        })
      })
    }
  }
  else {
    return res.redirect('/login')
  }
})
router.get('/uredi-korisnika/:id', async (req, res, next) => {
  // provjeravamo da li administrator pokusava da pristupi podacima
    if(req.isAuthenticated()) {
      if(req.user.radno_mjesto_id !== 1)
        return res.redirect('/dashboard')
      else {
        await pool.connect((err, client, done) => {
          client.query('SELECT u.id as id, u.name as name, u.surname as surname, u.email as email, r.naziv_radnog_mjesta as naziv_radnog_mjesta, u2.name as nadredjeni, u2.email as nadredjeni_email FROM users u join radna_mjesta r on r.id = u.radno_mjesto_id left outer join users u2 on u2.id = u.nadredjeni_id WHERE u.id = $1;', [req.params.id], (err, results) => {
            if (err)
              throw err
            client.query('SELECT * FROM radna_mjesta', [], (err, results2) => {
              if (err)
                throw err
              client.query('SELECT * FROM users', [], (err, results3) => {
                done()
                res.render('uredi-korisnika', {
                  podaci: results.rows[0],
                  radnaMjesta: results2.rows,
                  sviNadredjeni: results3.rows,
                  radnoMjestoID: req.user.radno_mjesto_id
                })
              })
            })

          })
        })
      }
    }
    else {
      return res.redirect('/login')
    }
})

router.post('/uredi-korisnika/uredi', async function (req, res, next) {
  if(req.isAuthenticated()) {
    if (req.user.radno_mjesto_id !== 1)
      return res.redirect('/dashboard')
    else {
      let { name, surname, email, radno_mjesto, nadredjeni } = req.body;

      const idRadnogMjesta = await pool.query('SELECT id FROM radna_mjesta where naziv_radnog_mjesta LIKE $1', [req.body.radno_mjesto])

      radno_mjesto = idRadnogMjesta.rows[0].id

      if(nadredjeni === '') {
        nadredjeni = null
      }
      else {
        const idNadredjenog = await pool.query('SELECT id FROM users WHERE email LIKE $1', [req.body.nadredjeni])
        nadredjeni = idNadredjenog.rows[0].id
      }
      await pool.connect((err, client, done) => {
        client.query('UPDATE users set name = $1, surname = $2, email = $3, radno_mjesto_id = $4, nadredjeni_id = $5 WHERE id = $6', [name, surname, email, radno_mjesto, nadredjeni, req.body.id], (err, result) => {
          done()
          if (err) {
            res.send(err, "Greška prilikom ažuriranja")
          }
          res.redirect('/admin/svi-korisnici')
        })
      })
    }
  }

})
router.get('/radno-vrijeme-na-datum', (req, res, next) => {
  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id !== 1)
      return res.redirect('/dashboard')
    else {
      res.render('radno-vrijeme-na-datum', {radnoMjestoID: req.user.radno_mjesto_id})
    }
  }
  else {
    return res.redirect('/login')
  }
})
router.get('/radno-vrijeme-na-x-datum', (req, res, next) => {

  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id !== 1)
      return res.redirect('/dashboard')
    else {
      pool.connect((err, client, done) => {
        client.query(`select
                          e.radnik_id,
                          concat(u.name,' ', u.surname) as ime_i_prezime,
                          u.radno_vrijeme_start as pocetak_radnog_vremena,
                          u.radno_vrijeme_end as kraj_radnog_vremena,
                          e.datum,
                          e.dolazak,
                          COALESCE(e.odlazak, u.radno_vrijeme_end) AS odlazak
                      from evidencija_radnog_vremena e
                      join users u on u.id = e.radnik_id
                      where e.datum = $1;`, [req.query.datum], (err, result) => {
          done()
          if(err)
            throw err

          return res.render('radno-vrijeme-na-datum-tabela', {podaci: result.rows, radnoMjestoID: req.user.radno_mjesto_id})
        })
      })
    }
  }
  else {
    return res.redirect('/login')
  }
})
router.post('/posalji-email', async (req, res, next) => {
  if (req.isAuthenticated()) {
    if (req.user.radno_mjesto_id !== 1)
      return res.redirect('/dashboard')
    var transporter = nodemailer.createTransport({
      service: 'outlook',
      auth: {
        user: 'amrazenkic21@gmail.com',
        pass: process.env.SIFRA
      }
    });
    var mailOptions = {
      from: 'amrazenkic21@gmail.com',
      to: 'amrazenkic21@gmail.com',
      subject: 'Izvještaj',
      html: req.body.data
    };
    await transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });

  } else {
    return res.redirect('/login')
  }
})

router.post('/pdf', async (req, res, next) => {
  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id !== 1)
      return res.redirect('/dashboard')
    const doc = new PDFDocumentTable();
    const podaci = JSON.parse(req.body.podaci)
    // https://www.npmjs.com/package/pdfkit-table  dokumentacija

    var redoviTabele = []
    for(let i = 0; i<podaci.length; i++) {
      let niz = [
        podaci[i].radnik_id,
        podaci[i].ime_i_prezime,
        podaci[i].pocetak_radnog_vremena,
        podaci[i].kraj_radnog_vremena,
        podaci[i].datum,
        podaci[i].dolazak,
        podaci[i].odlazak
      ]
      redoviTabele.push(niz)
    }

    // table
    const table = {
      title: "Izvještaj",
      headers: [ "ID", "Ime i prezime", "Početak radnog vremena", "Kraj radnog vremena", "Datum", "Dolazak", "Odlazak" ],
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
router.post('/pdf-radni-sati-po-radniku', async (req, res, next) => {
  if(req.isAuthenticated()) {
    if(req.user.radno_mjesto_id !== 1)
      return res.redirect('/dashboard')
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
      title: req.body.radnik,
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
    res.redirect('/login')
  }

})



module.exports = router;
