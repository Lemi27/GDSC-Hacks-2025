const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();

app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}));

app.use(express.static(path.join(__dirname, 'static')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const mongoURL = "mongodb://localhost:27017";
const dbName = 'credentials';
const CollectionName = 'credentials';

// Root URL shows the login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static/index.html'));
});

// Optional alias for /login that redirects to /
app.get('/login', (req, res) => {
  res.redirect('/');
});

// Protected home page route
app.get('/home', (req, res) => {
  if (req.session.loggedin) {
    res.sendFile(path.join(__dirname, 'static/home.html'));
  } else {
    res.redirect('/');
  }
});

// Handle login submission
app.post('/auth', async (req, res) => {
  try {
    const username = req.body.username;
    const password = req.body.password;

    const client = new MongoClient(mongoURL);
    await client.connect();

    const db = client.db(dbName);
    const collection = db.collection(CollectionName);

    const userResult = await collection.find({ username, password }).toArray();
    client.close();

    if (userResult.length === 1) {
      req.session.loggedin = true;
      req.session.username = username;
      res.redirect('/home');
    } else {
      res.redirect('/');
    }
  } catch (err) {
    console.error('Failed to authenticate', err);
    res.status(500).send('Internal server error');
  }
});

// Log out route
app.get('/logout', (req, res) => {
  if (req.session.loggedin) {
    req.session.destroy();
    res.redirect('/');
  } else {
    res.send('You are not logged in');
  }
});

app.listen(3010, () => console.log('Running on http://localhost:3010'));