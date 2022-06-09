require('dotenv').config();
const tc = require('./table-creation.js');
const mysql = require('mysql');
const server = require('../server.js');
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const req = require('express/lib/request');
const { v4: uuidv4 } = require('uuid');
const redisPackage = require('redis');

const redisClient = redisPackage.createClient();

exports.redis = redisClient;

redisClient.on('connect', function() {

 console.log('Redis Connected!');


});

redisClient.connect();


exports.select = (redicConnection, mysqlPool, datatbase, fields, condition, expire = null) => {
    return new Promise((resolve, reject) => {
        // check to see if answer is in redis
        // if yes, resolve the result

        // if not, query mysql
            // store result in redis
            // resolve the result
    });
}

const update = (redicConnection, mysqlPool, datatbase, fields, condition, expire = null) => {
     
}

const pretty = str => JSON.stringify(str, null, 4);

const esc = val => {
    return server.dbPool.escape(val, true);
}

exports.pquery = sql => {
    return new Promise((resolve, reject) => {
        server.dbPool.query(sql, (err, dbResult, fields) => {
            if(err) reject(err);
            else resolve(dbResult);
        })
    })
}

const poolQuery = sql => {
    return new Promise((resolve, reject) => {
        server.dbPool.query(sql, (err, dbResult, fields) => {
            if(err) reject(err);
            else resolve(dbResult);
        })
    })
}

exports.createTables = () => {
 
    server.dbPool.query(tc.createUpdatesTable, (err, res, fields) => {
        if(err) console.error('Db error: ', err);
        else console.log('Created Table: updates');
    });

    server.dbPool.query(tc.createTreesTable, (err, res, fields) => {
        if(err) console.error('Db error: ', err);
        else console.log('Created Table: trees');
    });

    server.dbPool.query(tc.createBranchesTable, (err, res, fields) => {
        if(err) console.error('Db error: ', err);
        else console.log('Created Table: branches');
    });

    server.dbPool.query(tc.createModulesTable, async (err, res, fields) => {
        if(err) console.error('Db error: ', err);
        else {
            console.log('Created Table: modules');

            await poolQuery('DELETE FROM modules');
            await poolQuery(`INSERT INTO modules (module_name, icon) VALUES ('Quill', '/svg/quill.svg')`);
            await poolQuery(`INSERT INTO modules (module_name, icon) VALUES ('Image Gallery', '/svg/image_gallery.svg')`);
            await poolQuery(`INSERT INTO modules (module_name, icon) VALUES ('Video Gallery', '/svg/video-player.svg')`);
            await poolQuery(`INSERT INTO modules (module_name, icon) VALUES ('Documents', '/svg/documents.svg')`);
            await poolQuery(`INSERT INTO modules (module_name, icon) VALUES ('Assets', '/svg/assets.svg')`);
            await poolQuery(`INSERT INTO modules (module_name, icon) VALUES ('Video Huddle', '/svg/video-huddle.svg')`);
            await poolQuery(`INSERT INTO modules (module_name, icon) VALUES ('Video Conference', '/svg/video-conference.svg')`);
            await poolQuery(`INSERT INTO modules (module_name, icon) VALUES ('Audio Huddle', '/svg/audio-huddle.svg')`);
            await poolQuery(`INSERT INTO modules (module_name, icon) VALUES ('Audio Conference', '/svg/audio-conference.svg')`);
            await poolQuery(`INSERT INTO modules (module_name, icon) VALUES ('Thread Chat', '/svg/thread-chat.svg')`);
        }
    });
}


exports.getTrees = (req, res) => {    
    const {userId} = req.token;

    if (!userId) return res.status(400).send('token missing userId');

    let sql = `SELECT tree_id, icon, color, tree_name, tree_desc, owner_name, updated_ts, type FROM trees WHERE user_id = ${userId}`;

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



const insertTree = (userId, treeId, icon, treeName, treeDesc, userName, branchId, res) => {
    const ts = Date.now();

    let sql = `INSERT INTO trees (user_id, tree_id, icon, tree_name, tree_desc, owner_name, branch_order, updated_ts) VALUES ('${Number(userId)}', '${treeId}', ${esc(icon)}, ${esc(treeName)}, ${esc(treeDesc)}, ${esc(userName)}, '["${branchId}_0"]', '${ts}')`;

    return new Promise((resolve, reject) => {
        server.dbPool.query(sql, (err, dbResult, fields) => {
            if(err) {
                console.error(pretty(err));
                if (err.errno === 1062) res.status(401).send(`${treeName} alread exists.`);
                else res.status(400).send('Database Error 1. Please try again later.');
                reject(err);
            }
            else {
                resolve(dbResult);
            }
        })
    })
}

const getCurrentTreeOrder = (userId, res) => {
    let sql = `SELECT tree_order FROM updates WHERE user_id=${userId}`;

    return new Promise((resolve, reject) => {
       
        server.dbPool.query(sql, (err, dbResult, fields) => { 
            if (err || !dbResult) {
                console.error('db err', pretty(err));
                console.error('db result', dbResult);
                res.status(400).send('Database Error 2. Please try again later.');   
                reject(err);             
            }    
            else {
                resolve(dbResult);
            }
        })
    })
}

const updateTreeOrder = (dbResult, userId, ts, treeId, res) => {
    if (dbResult.length === 0) {
        sql = `INSERT INTO updates (user_id, trees_ts, tree_order) VALUES (${userId}, ${ts}, '[${esc(treeId)}]')`;
    } else {
        console.log('dbResult', dbResult);
        console.log('dbResult[0]', dbResult[0], typeof dbResult[0]);
        
        let treeOrder = JSON.parse(dbResult[0].tree_order);
        treeOrder.unshift(treeId);
        sql = `UPDATE updates SET tree_order='${JSON.stringify(treeOrder)}', trees_ts=${ts} WHERE user_id = ${userId}`;
    }

    return new Promise((resolve, reject) => {
        server.dbPool.query(sql, (err, dbResult, fields) => { 
            if (err) {
                console.error(pretty(err));
                res.status(400).send('Database Error 3. Please try again later.');
                reject(err)
            }
            else {
                resolve(dbResult);
            }
        })
    })
}

const addNewBranch = (branchId, treeId, ts, res) => {
 
    let sql = `INSERT INTO branches (branch_id, tree_id, updated_ts) VALUES (${esc(branchId)}, '${treeId}', '${ts}')`;

    return new Promise((resolve, reject) => {
        server.dbPool.query(sql, (err, dbResult, fields) => {
            if(err) {
                console.error(pretty(err));
                res.status(400).send('Database Error 5. Please try again later.');
                reject(err);
            }
            else {
                resolve(dbResult);
            }
        })
    })
}

exports.createTree = (req, res) => {
    const {icon, treeName, treeDesc} = req.body;

    if (
        !icon ||
        !treeName ||
        treeDesc === undefined
    ) return res.status(401).send('missing data');

    const {userId, userName} = req.token;
    const treeId = `T_${userId}_${uuidv4()}`;
    const branchId = `B_${userId}_${uuidv4()}`;

    if (Number(userId) <= 0) return res.status(403).send('forbidden');
    
    console.log(userId, userName);
    console.log(icon, treeName);

    const ts = Date.now();

    insertTree(userId, treeId, icon, treeName, treeDesc, userName, branchId, res)
    .then(response => {
        return getCurrentTreeOrder(userId, res);
    })
    .then(response => {
        return updateTreeOrder(response, userId, ts, treeId, res);
    })
    .then(response => {
        return addNewBranch(branchId, treeId, ts, res);
    })
    .then(response => {
        return this.getTrees(req, res);
    }) 
    .catch(err => {
        console.log("caught error", err);
    }) 
}

exports.createTreeOrig = (req, res) => {
    const {icon, treeName, treeDesc} = req.body;

    if (
        !icon ||
        !treeName ||
        treeDesc === undefined
    ) return res.status(401).send('missing data');

    const {userId, userName} = req.token;
    const treeId = `T_${userId}_${uuidv4()}`;
    const branchId = `B_${userId}_${uuidv4()}`;

    if (Number(userId) <= 0) return res.status(403).send('forbidden');
    
    console.log(userId, userName);
    console.log(icon, treeName);

    const ts = Date.now();

    let sql = `INSERT INTO trees (user_id, tree_id, icon, tree_name, tree_desc, owner_name, branch_order, updated_ts) VALUES ('${Number(userId)}', '${treeId}', ${esc(icon)}, ${esc(treeName)}, ${esc(treeDesc)}, ${esc(userName)}, ${"'"}, ${ts})`

    server.dbPool.query(sql, (err, dbResult, fields) => {
        if(err) {
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
                sql = `INSERT INTO updates (user_id, trees_ts, tree_order) VALUES (${userId}, ${ts}, '[${esc(treeId)}]')`;
            } else {
                console.log('dbResult', dbResult);
                console.log('dbResult[0]', dbResult[0], typeof dbResult[0]);
                let treeOrder = JSON.parse(dbResult[0].tree_order);
                treeOrder.unshift(treeId);
                sql = `UPDATE updates SET tree_order='${JSON.stringify(treeOrder)}', trees_ts=${ts} WHERE user_id = ${userId}`;
            }

                // add new tree to tree order
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

    let sql = `UPDATE trees SET icon = ${esc(icon)}, tree_name = ${esc(treeName)}, tree_desc = ${esc(treeDesc)}, updated_ts = ${ts} WHERE tree_id = ${esc(treeId)}`;
    
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

    let sql = `SELECT user_id FROM trees WHERE tree_id=${esc(treeId)}`;

    server.dbPool.query(sql, (err, dbResult, fields) => { 
        if (err) return res.status(400).send('Database Error 1: Please try again later.');
        
        let testUserId = dbResult[0].user_id;

        if (testUserId !== userId) return res.status(401).send('unauthorized');

        sql = `DELETE FROM trees WHERE tree_id=${esc(treeId)}`;

        //TODO: Make sure branches container foreign key

        server.dbPool.query(sql, (err, dbResult, fields) => {
            if (err) return res.status(400).send('Database Error 2: Please try again later.');
        
            res.status(200).send('ok');
         });
    });

    
});