const express = require('express');
const cors = require('cors');
const app = express();
const https = require('https');
const fs = require('fs');
const mysql = require('mysql');
// const db = require('./database/database-interface.js');
// const authenticationRoutes = require('./routes/authentication.js');

require('dotenv').config();

// pooled mysql connection
// const dbPoolInfo = {
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT),
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_DATABASE,
//   connectionLimit: Number(process.env.DB_CONNECTION_LIMIT),
//   queueLimit: Number(process.env.DB_QUEUE_LIMIT),
//   charset: 'utf8'
// }

// exports.dbPool = mysql.createPool(dbPoolInfo);
// db.createTables();

app.use((req, res, next) => {
  console.log(req.url);
  next();
 });
 
 

app.use(express.static('public'));
app.use(express.json({limit: '200mb'})); 
app.use(cors());

// app.use('/authentication', authenticationRoutes);

const httpsServer = https.createServer({
  key: fs.readFileSync(`/etc/letsencrypt/live/${process.env.DOMAIN}/privkey.pem`),
  cert: fs.readFileSync(`/etc/letsencrypt/live/${process.env.DOMAIN}/fullchain.pem`),
}, app);


httpsServer.listen(process.env.PORT, () => {
 console.log(`HTTPS Server running on port ${process.env.PORT}`);
});



