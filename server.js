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
const dbName = 'hackathon2025';
const collectionProfile = 'credentials';

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
    const collection = db.collection(collectionProfile);

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

//Routing to html
app.get( '/signupform', (req, res) => {
  if (req.session.loggedin) {
    res.sendFile(path.join(__dirname + '/signup.html'));
  } else {
    res.redirect( '/login');
  }
  
} );

//Create new user:
app.post('/auth/signup', async (req, res) => {
  try {
    console.log('Inside signup');
    
    // Extract user credentials from request body
    const username = req.body.username;
    const password = req.body.password;
    
    console.log({ username, password });

    const client = new MongoClient(mongoURL);
    await client.connect();
    console.log('Connected to db');
    
    const db = client.db(dbName);  //Access db
    const collection = db.collection(collectionProfile); // Access credentials collection

    // Insert new user into MongoDB
    const result = await collection.insertOne({ username, password });

    console.log(result);
    console.log('User inserted into database');
    
    client.close();
    
    // Send success response
    res.send({ message: 'Account created successfully!', id: result.insertedId });

  } catch (err) {
    console.error('Failed', err);
    res.status(500).send('Internal server error');
  }
});

//Edit profile:
app.get('/profile/edit', (req, res) => {
  if (req.session.loggedin) {
    res.sendFile(path.join(__dirname, 'edit-profile.html'));
  } else {
    res.redirect('/login');
  }
});

app.post('/profile/update', async (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/login');
  }

  const profile = {
    name: req.body.name,
    age: parseInt(req.body.age),
    gender: req.body.gender,
    bio: req.body.bio,
    budget: parseInt(req.body.budget),
    location: req.body.location,
    lifestyle: {
      smoker: req.body.smoker === 'on',
      nightOwl: req.body.nightOwl === 'on'
    }
  };

  try {
    const client = new MongoClient(mongoURL);
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('credentials');

    await collection.updateOne(
      { username: req.session.username },
      { $set: { profile: profile } }
    );

    client.close();
    res.send('Profile updated successfully!');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating profile.');
  }
});



app.listen(3010, () => console.log('Running on http://localhost:3010'));