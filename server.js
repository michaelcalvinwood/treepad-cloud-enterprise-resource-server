const express = require('express');
const cors = require('cors');
const app = express();
const https = require('https');
const fs = require('fs');
const mysql = require('mysql');
const db = require('./database/database-interface.js');
const routes = require('./routes/routes.js');
const jwt = require('jsonwebtoken');
const socketio = require('socket.io');
const sockUtils = require('./utils/resourceSocketUtils');
const redisPackage = require('redis');
const redis = redisPackage.createClient();

redis.on('connect', function() {

 console.log('Redis Connected!');

 redis.set('test', 'I am test');
 redis.get('test')
 .then(result => {
   console.log(`test: ${result}`);
 }) 

});

redis.connect();

require('dotenv').config();

const httpsServer = https.createServer({
  key: fs.readFileSync(`/etc/letsencrypt/live/${process.env.DOMAIN}/privkey.pem`),
  cert: fs.readFileSync(`/etc/letsencrypt/live/${process.env.DOMAIN}/fullchain.pem`),
}, app);

const connection = httpsServer.listen(process.env.PORT, () => {
  console.log(`HTTPS Server running on port ${process.env.PORT}`);
 });
 

const io = socketio(connection, {
  cors: {
      origin: '*',
      methods: ['GET', 'POST']
  }
});

io.on('connection', socket => sockUtils.socketCommunication(io, socket));

//pooled mysql connection

const dbPoolInfo = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT),
  queueLimit: Number(process.env.DB_QUEUE_LIMIT),
  charset: 'utf8'
}

exports.dbPool = mysql.createPool(dbPoolInfo);
db.createTables();

app.use(express.static('public'));
app.use(express.json({limit: '200mb'})); 
app.use(cors());

// all resource routes require an authenticated bearer token
// the contents of the bearer token are added to the req object

app.use((req, res, next) => {
  console.log(req.url);
  const token = getToken(req);

  if (!token) return res.status(403).json({ error: "No token. Unauthorized." });
  
  const verified = jwt.verify(token, process.env.SECRET_KEY);

  if (!verified ) return res.status(401).json({ error: "Not Authorized." });

  req.token = jwt.decode(token);
  next();

 });
 
function getToken(req) {
  if (!req.headers.authorization) return false;

  return req.headers.authorization.split(" ")[1];
}

app.use('/', routes);




