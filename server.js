const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { MongoClient } = require('mongodb');
const axios = require('axios');

const app = express();
const mongoURL = "mongodb://localhost:27017";
const dbName = 'hackathon2025';
const collectionProfile = 'credentials';

// Middleware setup
app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}));

app.use(express.static(path.join(__dirname, 'static')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Root login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// Alias for /login
app.get('/login', (req, res) => {
  res.redirect('/');
});

// Home page (protected)
app.get('/home', (req, res) => {
  if (req.session.loggedin) {
    res.sendFile(path.join(__dirname, 'static', 'home.html'));
  } else {
    res.redirect('/');
  }
});

// Handle login
app.post('/auth', async (req, res) => {
  const { username, password } = req.body;

  try {
    const client = new MongoClient(mongoURL);
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionProfile);

    const user = await collection.findOne({ username, password });
    await client.close();

    if (user) {
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

// Log out
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Signup form
app.get('/signupform', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'signup.html'));
});

// Create new user
app.post('/auth/signup', async (req, res) => {
  const { username, password } = req.body;

  try {
    const client = new MongoClient(mongoURL);
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionProfile);

    const existing = await collection.findOne({ username });
    if (existing) {
      await client.close();
      return res.status(409).send({ message: 'Username already exists.' });
    }

    const result = await collection.insertOne({ username, password });
    await client.close();

    res.send({ message: 'Account created successfully!', id: result.insertedId });
  } catch (err) {
    console.error('Signup failed', err);
    res.status(500).send('Internal server error');
  }
});

// Profile view

app.get('/profile', (req, res) => {
  console.log("Received profile insert request");

  if (req.session.loggedin) {
    res.sendFile(path.join(__dirname, 'static', 'home.html'));
  } else {
    res.redirect('/');
  }
});

// Profile edit form
app.get('/profile/edit', (req, res) => {
  if (req.session.loggedin) {
    res.sendFile(path.join(__dirname, 'static', 'edit-profile.html'));
  } else {
    res.redirect('/');
  }
});

// Update profile
app.post('/profile/update', async (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/');
  }

  const profile = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    phoneNumber: req.body.phoneNumber,
    email: req.body.email,
    gender: req.body.gender,
    description: req.body.description,
    location: req.body.location,
    socialMedia: {
      linkedin: req.body.linkedin,
      instagram: req.body.instagram
    },
    education: {
      schoolName: req.body.schoolName,
      programName: req.body.programName,
      date: req.body.date,
      description: req.body.educationDescription
    },
    lifestyle: {
      neatness: req.body.neatness,
      noiseLevel: req.body.noiseLevel,
      budget: req.body.budget,
      other: req.body.other
    },
    interests: {
      favouriteSports: req.body.favouriteSports,
      hobbies: req.body.hobbies,
      favouriteTvShows: req.body.favouriteTvShows,
      favouriteMovies: req.body.favouriteMovies,
      favouriteBooks: req.body.favouriteBooks,
      favouriteFood: req.body.favouriteFood
    }
  };

  try {
    const client = new MongoClient(mongoURL);
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionProfile);

    await collection.updateOne(
      { username: req.session.username },
      { $set: { profile } }
    );

    await client.close();
    res.send('Profile updated successfully!');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating profile.');
  }
});

// Fetch current user's profile data (API)
app.get('/api/profile', async (req, res) => {
  if (!req.session.loggedin || !req.session.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const client = new MongoClient(mongoURL);
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionProfile);
    const user = await collection.findOne({ username: req.session.username });

    await client.close();

    if (!user || !user.profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({ profile: user.profile });
  } catch (err) {
    console.error('Error retrieving profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Gemini AI matchmaking
app.post('/api/match', async (req, res) => {
  try {
    console.log("Received match request with prompt:", req.body);

    const client = new MongoClient(mongoURL);
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionProfile);

    const allProfiles = await collection.find({ profile: { $exists: true } }).toArray();
    await client.close();

    console.log("Profiles found:", allProfiles.length); // ✅ Debugging

    const profilesText = allProfiles.map(p => 
      `${p.username}: ${JSON.stringify(p.profile)}`
    ).join('\n\n');

    const prompt = `
User: ${req.body.prompt}

Profiles:
${profilesText}
`;

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured" });
    }
    
    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log("Gemini response:", geminiRes.data); 

    res.json(geminiRes.data);
  } catch (err) {
    console.error("Error querying Gemini:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});



app.listen(3010, () => console.log('Running on http://localhost:3010'));
