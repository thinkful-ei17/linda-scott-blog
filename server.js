'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const morgan = require('morgan');

mongoose.Promise = global.Promise;

const{PORT, DATABASE_URL} = require('./config');
const { Article } = require('./models');

const app = express();
app.use(bodyParser.json());
app.use(morgan());
app.get('/posts', (req, res) => {
  Article
    .find()
    .then(articles => { //results for find request
      res.json({ //with the results, send json response with 
        articles: articles.map( //object which contains key articles and the value is an array of the find response articles
          (article) => article.serialize()) //each item in the array also serialize to include title, content and author
      });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error'});
    });
});

app.get('/posts/:id', (req, res) => {
  Article
    .findById(req.params.id)
    .then(article => 
      res.json(article.serialize()))
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error'});
    });
});

app.post('/posts', (req, res) => {

  const requiredFields = ['title', 'content', 'author'];

  for (let i = 0; i < requiredFields.length; i++){
    const field = requiredFields[i];
    if(!(field in req.body)){
      const message = `Missing ${field} in request body`;
      console.error(message);
      return res.status(400).send(message);
    }
  }

  Article 
    .create({
      title: req.body.title,
      content: req.body.content,
      author: {
        firstName: req.body.author.firstName,
        lastName: req.body.author.lastName
      }
    })
    .then(article => res.status(201).json(article.serialize()))
    .catch(err => {
      console.error(err);
      res.status(500).json({message: 'Internal server error'});
    });
});


app.put('/posts/:id', (req, res) => {
  if(!(req.params.id && req.body.id && req.params.id === req.body.id)){
    return res.status(400).send(`Id in request path: ${req.params.id} and request body: ${req.body.id} must match`);
  }else{
    
    const fieldsToUpdate = {};
    const possibleFields = ['title', 'author', 'content'];

    for(let i = 0; i < possibleFields.length; i++){
      const field = possibleFields[i];
      if (field in req.body) {
        fieldsToUpdate[field] = req.body[field];
      }
    }

    Article
      .findByIdAndUpdate(req.params.id, 
        {$set: fieldsToUpdate},
        {new: true}
      )
      .then(result => res.json(result.serialize()))
      .catch(err => {
        console.error(err);
        res.status(500).json({message:'Internal Server Error'});
      }
      );
  }
});

app.delete('/posts/:id', (req, res) => {
  
  Article
    .findByIdAndRemove(req.params.id)
    .then(article =>
      res.status(204).end())
    .catch(err => {
      console.error(err);
      res.status(500).json({message: 'Internal Server Error'});
    }); 
});


// catch-all endpoint if client makes request to non-existent endpoint
app.use('*', function (req, res) {
  res.status(404).json({ message: 'Not Found' });
});


// closeServer needs access to a server object, but that only
// gets created when `runServer` runs, so we declare `server` here
// and then assign a value to it in run
let server;

// this function connects to our database, then starts the server
function runServer(databaseUrl = DATABASE_URL, port = PORT) {

  return new Promise((resolve, reject) => {
    mongoose.connect(databaseUrl, { useMongoClient: true }, err => {
      if (err) {
        return reject(err);
      }
      server = app.listen(port, () => {
        console.log(`Your app is listening on port ${port}`);
        resolve();
      })
        .on('error', err => {
          mongoose.disconnect();
          reject(err);
        });
    });
  });
}

// this function closes the server, and returns a promise. we'll
// use it in our integration tests later.
function closeServer() {
  return mongoose.disconnect().then(() => {
    return new Promise((resolve, reject) => {
      console.log('Closing server');
      server.close(err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  });
}

// if server.js is called directly (aka, with `node server.js`), this block
// runs. but we also export the runServer command so other code (for instance, test code) can start the server as needed.
if (require.main === module) {
  runServer().catch(err => console.error(err));
}

module.exports = { app, runServer, closeServer };
