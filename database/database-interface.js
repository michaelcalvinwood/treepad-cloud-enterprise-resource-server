const tc = require('./table-creation.js');
const mysql = require('mysql');
const server = require('../server.js');
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const req = require('express/lib/request');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

const pretty = str => JSON.stringify(str, null, 4);

exports.createTables = () => {
 
    server.dbPool.query(tc.createUpdatesTable, (err, res, fields) => {
        if(err) console.error('Db error: ', err);
        else console.log('Created Table: updates');
    });

    server.dbPool.query(tc.createTreesTable, (err, res, fields) => {
        if(err) console.error('Db error: ', err);
        else console.log('Created Table: trees');
    });
}

exports.createTree = (req, res) => {
    const {token, icon, treeName, treeDesc} = req.body;

    if (
        !token ||
        !icon ||
        !treeName ||
        treeDesc === undefined
    ) return res.status(401).send('missing data');

    if (!jwt.verify(token, process.env.SECRET_KEY)) return res.status(403).json({ error: "Not Authorized." });
    
    const {userId, userName} = jwt.decode(token);
    const treeId = `${userId}--${uuidv4()}`;

    if (Number(userId) <= 0) return res.status(403).send('forbidden');
    
    console.log(userId, userName);
    console.log(icon, treeName);

    const ts = Date.now();

    let sql = `INSERT INTO trees (user_id, tree_id, icon, tree_name, owner_name, updated_ts) VALUES ('${Number(userId)}', '${treeId}', '${icon}', '${treeName}', '${userName}', '${ts}')`

    server.dbPool.query(sql, (err, dbResult, fields) => {
        if(err) {
            // TODO: Check for duplicate entry and alert user if that's the case
            console.error(pretty(err));
            const error = JSON.parse(err);
            if (err.errno === 1062) return res.status(401).send(`Error: Tree ${treeName} alread exists.`)
            return res.status(400).send('Database Error. Please try again later.')
        }

        let sql = `SELECT tree_order FROM updates WHERE user_id=${userId}`;

        server.dbPool.query(sql, (err, dbResult, fields) => { 
            if (err || !dbResult || !dbResult[0]) {
                console.error(pretty(err));
                return res.status(400).send('Database Error. Please try again later.');                
            }

            console.log('dbResult', pretty(dbResult));
            
            if (!dbResult[0].tree_order) return res.status(400).send('Database Error. Please try again later.'); 
            
            const treeOrder = JSON.parse(dbResult[0].tree_order);

            treeOrder.unshift(treeId);

            const ts = Date.now();

            res.status(200).send('success');

            
        })

        
    });
}

// [
//     {
//         "tree_id": "33--dfa0c4c4-1632-48f5-8952-b4199cda4d4f",
//         "icon": "/svg/light/rings-wedding.svg",
//         "color": "#000000",
//         "tree_name": "Wedding",
//         "owner_name": "admin",
//         "branch_order": "",
//         "updated_ts": 1653694481634,
//         "type": "private"
//     }
// ]

exports.getTrees = (req, res) => {
    const {token} = req.query;

    if (!token) return res.status(401).send('missing token');

    if (!jwt.verify(token, process.env.SECRET_KEY)) return res.status(403).json({ error: "Not Authorized." });
    
    const {userId} = jwt.decode(token);

    if (!userId) return res.status(400).send('token missing userId');

    let sql = `SELECT tree_id, icon, color, tree_name, owner_name, updated_ts, type FROM trees WHERE user_id = '${userId}'`;

    server.dbPool.query(sql, (err, dbResult, fields) => {
        if(err) {
            // TODO: Check for duplicate entry and alert user if that's the case
            console.error('Db error: ', err);
            return res.status(400).send('Database Error. Please try again later.')
        }

        console.log(pretty(dbResult));
        
        res.status(200).send(dbResult);
    });
}

