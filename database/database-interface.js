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


exports.getTrees = (req, res) => {    
    const {userId} = req.token;

    if (!userId) return res.status(400).send('token missing userId');

    let sql = `SELECT tree_id, icon, color, tree_name, tree_desc, owner_name, updated_ts, type FROM trees WHERE user_id = '${userId}'`;

    server.dbPool.query(sql, (err, dbResult, fields) => {
        if(err) {
            // TODO: Check for duplicate entry and alert user if that's the case
            console.error('Db error: ', err);
            return res.status(400).send('Database Error. Please try again later.')
        }

        // console.log(pretty(dbResult));
        
        res.status(200).send(dbResult);
    });
}

exports.createTree = (req, res) => {
    const {icon, treeName, treeDesc} = req.body;

    if (
        !icon ||
        !treeName ||
        treeDesc === undefined
    ) return res.status(401).send('missing data');

    const {userId, userName} = req.token;
    const treeId = `${userId}--${uuidv4()}`;

    if (Number(userId) <= 0) return res.status(403).send('forbidden');
    
    console.log(userId, userName);
    console.log(icon, treeName);

    const ts = Date.now();

    let sql = `INSERT INTO trees (user_id, tree_id, icon, tree_name, tree_desc, owner_name, updated_ts) VALUES ('${Number(userId)}', '${treeId}', '${icon}', '${treeName}', '${treeDesc}', '${userName}', '${ts}')`

    server.dbPool.query(sql, (err, dbResult, fields) => {
        if(err) {
            // TODO: Check for duplicate entry and alert user if that's the case
            console.error(pretty(err));
            if (err.errno === 1062) return res.status(401).send(`${treeName} alread exists.`)
            return res.status(400).send('Database Error 1. Please try again later.')
        }

        let sql = `SELECT tree_order FROM updates WHERE user_id=${userId}`;

        server.dbPool.query(sql, (err, dbResult, fields) => { 
            if (err || !dbResult) {
                console.error('db err', pretty(err));
                console.error('db result', dbResult);
                return res.status(400).send('Database Error 2. Please try again later.');                
            }

            if (dbResult.length === 0) {
                sql = `INSERT INTO updates (user_id, trees_ts, tree_order) VALUES (${userId}, ${ts}, '["${treeId}"]')`;
            } else {
                console.log('dbResult', dbResult);
                console.log('dbResult[0]', dbResult[0], typeof dbResult[0]);
                let treeOrder = JSON.parse(dbResult[0].tree_order);
                treeOrder.unshift(treeId);
                sql = `UPDATE updates SET tree_order='${JSON.stringify(treeOrder)}', trees_ts=${ts} WHERE user_id = ${userId}`;
            }

            server.dbPool.query(sql, (err, dbResult, fields) => { 
                if (err) {
                    console.error(pretty(err));
                    return res.status(400).send('Database Error 3. Please try again later.');
                }

                return this.getTrees(req, res);
            });
            
        })
        
    });
}

exports.updateTree = (req, res) => {
    const { treeId } = req.params;

    const {icon, treeName, treeDesc} = req.body;

    if (
        !icon ||
        !treeName ||
        treeDesc === undefined
    ) return res.status(401).send('missing data');

    const {userId, userName} = req.token;
    
    if (Number(userId) <= 0) return res.status(403).send('forbidden');
    
    console.log(userId, userName);
    console.log(icon, treeName);

    const ts = Date.now();

    let sql = `UPDATE trees SET icon = '${icon}', tree_name = '${treeName}', tree_desc = '${treeDesc}', updated_ts = ${ts} WHERE tree_id = '${treeId}'`;
    
    server.dbPool.query(sql, (err, dbResult, fields) => {
        if(err) {
            // TODO: Check for duplicate entry and alert user if that's the case
            console.error(pretty(err));
            if (err.errno === 1062) return res.status(401).send(`${treeName} alread exists.`)
            return res.status(400).send('Database Error 1. Please try again later.')
        }

        return this.getTrees(req, res);
    });
}

exports.deleteTree = ((req, res) => {
    console.log(req.params);

    if (!req.params.treeId) return res.status(400).send('missing treeId');

    const { treeId } = req.params;
    let {userId, userName} = req.token;

    console.log('type of userId', typeof userId)

    let sql = `SELECT user_id FROM trees WHERE tree_id='${treeId}'`;

    server.dbPool.query(sql, (err, dbResult, fields) => { 
        if (err) return res.status(400).send('Database Error 1: Please try again later.');
        
        let testUserId = dbResult[0].user_id;

        if (testUserId !== userId) return res.status(401).send('unauthorized');

        sql = `DELETE FROM trees WHERE tree_id='${treeId}'`;

        //TODO: Make sure branches container foreign key

        server.dbPool.query(sql, (err, dbResult, fields) => {
            if (err) return res.status(400).send('Database Error 2: Please try again later.');
        
            res.status(200).send('ok');
         });
    });

    
});