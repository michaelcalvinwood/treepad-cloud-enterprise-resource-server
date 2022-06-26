const jwt = require('jsonwebtoken');
const debug = require('./debugUtils');
const db = require('../database/database-interface');
const server = require('../resourceServer.js');
const monitor = require('./eventMonitor');

const fn = 'resourceSocketUtils.js ';

/* Database Error Codes
    5001: No branch_order found in trees for tree_id
    5002: Database error when trying to select branch_order from tree_id
*/

const esc = val => {
    return server.dbPool.escape(val, true);
}

const sendToastMessage = (io, socket, message) => {
    console.log(`Sending toast: ${message}`);
    io.to(socket.id).emit('toastMessage', message);
    
}

const authenticateToken = token => {
    if (!token) return false;

    const verified = jwt.verify(token, process.env.SECRET_KEY);

    if (!verified ) return false;
  
    return jwt.decode(token);
}

const subscribeToTree = async (io, socket, resourceId, token) => {
    const p = 'resourceServer|resourceSocketUtils.js|subscribeToTree';
    monitor.events(io, socket, ['clickLoginSubmit'], {p, resourceId});

    socket.join(resourceId);


    const key = `${resourceId}:branchOrder`;
    const ts = Date.now();
    const focus = null;

    const redisVal = await db.redis.hGet(key, 'redisVal');

    monitor.events(io, socket, ['clickLoginSubmit'], {p, key, ts, focus, redisVal})

    if (redisVal && Object.keys(redisVal).length) {
        return io.to(socket.id).emit('branchOrder', resourceId, redisVal, focus, socket.id);
    }

    const sql = `SELECT branch_order FROM trees WHERE tree_id=${esc(resourceId)}`;

    monitor.events(io, socket, ['clickLoginSubmit'], {p, sql});

    let branchOrder;
    try {
        branchOrder = await db.pquery(sql);
        if (!branchOrder || !branchOrder.length) return sendToastMessage(io, socket, "Database Error 5001: Please try again later.");
    } catch (e) {
        debug.d(e);
        return sendToastMessage(io, socket, "Database Error 5002: Please try again later.");
    }

    const branchOrderResult = branchOrder[0].branch_order;
    const sender = socket.id;
 
    monitor.events(io, socket, ['clickLoginSubmit'], {p, resourceId, branchOrderResult, focus, sender});

    monitor.events(io, socket, ['clickLoginSubmit'], {p, emit: 'branchOrder'});
    
    io.to(socket.id).emit('branchOrder', resourceId, branchOrderResult, focus, sender);
}

const subscribeToBranch = (io, socket, resourceId, token) => {
    sendToastMessage(io, socket, 'Branch subscription coming soon')
}

const subscribeToLeaf = (io, socket, resourceId, token) => {
    sendToastMessage(io, socket, 'Leaf subscription coming soon');
    
}

const getResourceParts = (resourceId, io, socket) => {
    if (!resourceId) {
        sendToastMessage(io, socket, `Missing resourceID`);
        return false;
    }

    if (typeof resourceId !== 'string') {
        sendToastMessage(io, socket, `Invalid resourceId type: ${typeof resourceId}`)
        return false;
    }

    const resourceIdParts = resourceId.split('_');

    if (resourceIdParts.length != 3) {
        sendToastMessage(io, socket, `Invalid resource: ${resourceId}`);
        return false;
    }

    const resource = {
        type: resourceIdParts[0],
        owner: Number(resourceIdParts[1]),
        uuid: resourceIdParts[2]
    }

    return resource;
}

const authenticate = (resource, token, io, socket) => {
    const auth = authenticateToken(token);

    if (!auth) {
        sendToastMessage(io, socket, 'Invalid Token');
        return false;
    }

    if (resource.owner !== auth.userId) {
        sendToastMessage(io, socket, 'Unauthorized'); 
        return false;
    }

    return resource;
}

const authenticateResource = (resource, token, io, socket, permissions) => {
    const parts = getResourceParts(resource, io, socket);
    if (!parts) return false;

    return authenticate(parts, token, io, socket);

}


// const sql = `UPDATE branches SET branch_name=${esc(branchName)} WHERE branch_id=${esc(branchId)}`;
    
//     db.pquery(sql)
//     .then(data => {
//         io.to(treeId).emit('branchName', branchId, branchName, socket.id);
//     })
//     .catch(err => {
//         console.log(err);
//         sendToastMessage(io, socket, 'Database Error: Please try again later.')
//     })


const setBranchOrder = (branchOrder, newBranchId, treeId, ancestors, io, socket) => {
    const key = `${treeId}:branchOrder`;
    const ts = Date.now();
    
    const fields = {
        redisVal: JSON.stringify(branchOrder),
        access: ts,
    }
    db.redis.hSet(key, fields);
    
    let dbMessage =  {
        p: 'resourceSocketUtils.js setBranchOrder()',
        treeId,
        branchOrder,
        newBranchId,
        key,
        fields,
        emit: 'branchOrder'
    };
    
    io.to(socket.id).emit('debugEvent', 'insertSibling', dbMessage);
    io.to(socket.id).emit('debugEvent', 'deleteBranch', dbMessage);
    
    const focus = newBranchId;
    io.to(treeId).emit('branchOrder', treeId, JSON.stringify(branchOrder), focus, socket.id);
}

const getBranchInfo = async (branchId, treeId, ancestors, io, socket) => {
    let key = '';
    let branchName = '';
    let modules = [];
    let defaultModule = -1;
    let sql, dbResult, redisResult;
    
    try {
        // get branchName
        key = `${branchId}:branchName`;
        branchName = await db.redis.get(key);
        monitor.events(io, socket, ['on'], {on: 'resourceServer|getBranchInfo', branchName, m: 'branchName from redis'});
        if (!branchName) {
            sql = `SELECT branch_name FROM branches WHERE branch_id = ${esc(branchId)}`;
            dbResult = await db.pquery(sql);
            branchName = dbResult[0].branch_name;
            monitor.events(io, socket, ['on'], {on: 'resourceServer|getBranchInfo', branchName, m: 'branchName from mysql', sql});
            await db.redis.set(key, branchName);
        }
        
        // get branch modules
        key = `${branchId}:modules`;
        redisResult = await db.redis.get(key);
        if (redisResult) modules = JSON.parse(redisResult);
        else {
            sql = `SELECT active_modules FROM branches WHERE branch_id = ${esc(branchId)}`;
            dbResult = await db.pquery(sql);
            await db.redis.set(key, dbResult[0].active_modules);
            modules = JSON.parse(dbResult[0].active_modules);
        }
        
        // get branch default module
        key = `${branchId}:defaultModule`;
        defaultModule = key;
        if (!defaultModule) {
            sql = `SELECT default_module FROM branches WHERE branch_id = ${esc(branchId)}`;
            dbResult = await db.pquery(sql);
            await db.redis.set(key, dbResult[0].default_module);
            defaultModule = dbResult[0].default_module;
        }
        
        monitor.events(io, socket, ['emit'], {emit: 'resourceServer|getBranchInfo', branchId, branchName, modules, defaultModule});
        
        io.to(socket.id).emit('getBranchInfo', branchId, branchName, modules, defaultModule);
    } catch(e) {
        monitor.events(io, socket, ['emit'], {emit: 'resourceServer|getBranchInfo', error: e});
    }
}

exports.socketCommunication = (io, socket) => {
    socket.on('resourceSubscribe', (resourceId, token) => {
        let dbMessage = {
            p: 'resourceSocketUtils.js on resourceSubscribe',
            resourceId
        }
        io.to(socket.id).emit('debugEvent', 'subscribeToTree', dbMessage);
        
        const resource = authenticateResource(resourceId, token, io, socket);
        if (!resource) return;
        
        switch(resource.type) {
            case 'T':
                subscribeToTree(io, socket, resourceId, token);
                break;
                case 'B':
                    subscribeToBranch(io, socket, resourceId, token);
                    break;
                    case 'L':
                        subscribeToLeaf(io, socket, resourceId, token);
                        break;
                        default:
                            sendToastMessage(io, socket, `Unknown resource type: ${resourceId})`);
                        }
                    })
                    
                    socket.on('setBranchName', async (branchId, branchName, treeId, ancestors, token, permissions = null) => {
                        monitor.events(io, socket, ['on'], {on: 'resourceServer|setBranchName', branchId, branchName, treeId, ancestors, token, permissions});
                        if (!authenticateResource(branchId, token, io, socket, permissions)) return; 
                        try {
                            const key = `${branchId}:branchName`;
                            await db.redis.set(key, branchName);
                            await db.redis.rPush('rcache', key);
                            // let sql = `UPDATE branches SET branch_name=${esc(branchName)} WHERE branch_id=${esc(branchId)}`;
                            // await db.pquery(sql);
                    
                            io.to(treeId).emit('setBranchName', branchId, branchName, socket.id);
                    
                        } catch (e) {
                            console.error(e);
                        }
                       
                    });
                    
                    socket.on('getBranchInfo', (branchId, treeId, ancestors, token, permissions = null) => {
                        monitor.events(io, socket, ['on'], {on: 'resourceServer|getBranchInfo', branchId, treeId, ancestors, token, permissions});
                        
                        if (!authenticateResource(branchId, token, io, socket, permissions)) return;
                        
                        getBranchInfo(branchId, treeId, ancestors, io, socket); 
                    })
                    
                    socket.on('setBranchOrder', (branchOrder, newBranchId, treeId, ancestors, token, permissions = null) => {
                        if (!authenticateResource(treeId, token, io, socket, permissions)) return;
                        
                        io.to(socket.id).emit('debugEvent', 'insertSibling', {
                            p: 'resourceSocketUtils.js on setBranchOrder',
                            branchOrder,
                            treeId,
                            newBranchId
                        });
                        io.to(socket.id).emit('debugEvent', 'deleteBranch', {
                            p: 'resourceSocketUtils.js on setBranchOrder',
                            branchOrder,
                            treeId,
                            newBranchId
                        });
                        setBranchOrder(branchOrder, newBranchId, treeId, ancestors, io, socket);
                    } );
                    
                    socket.on('getAllModules', () => {
                        monitor.events(io, socket, ['displayModules', 'on'], {on: 'resourceServer|getAllModules'});
                        
                        db.pquery('SELECT module_id, module_name, icon, server, port, url FROM modules')
                        .then(data => {
                            monitor.events(io, socket, ['displayModules', 'emit'], {emit: 'resourceServer|getAllModules', data});
                            io.to(socket.id).emit('getAllModules', data);
                        })
                        .catch(err => {
                            console.error(err);
                        })
                        
                    } ); 
                    
                    socket.on('branchCurModule', async (branchId, moduleId) => {
                        monitor.events(io, socket, ['on'], {on: 'resourceServer|branchCurModule', branchId, moduleId});
                        
                        try {
                            let sql = `UPDATE branches SET default_module=${moduleId} WHERE branch_id=${esc(branchId)}`;
                            let updateResult = await db.pquery(sql);
                            
                            let key = `${branchId}:curModule`;
                            await db.redis.set(key, moduleId);
                            
                            sql = `SELECT active_modules FROM branches WHERE branch_id=${esc(branchId)}`;
                            const selectResult = await db.pquery(sql);
                            const activeModules = JSON.parse(selectResult[0].active_modules);
                            
                            const curModule = activeModules.find(m => m === moduleId);
                            
                            if (!curModule) {
                                activeModules.push(moduleId);
                                sql = `UPDATE branches SET active_modules=${esc(JSON.stringify(activeModules))} WHERE branch_id=${esc(branchId)}`;
                                updateResult = await db.pquery(sql);
                            }
                            
                            key = `${branchId}:activeModules`;
                            await db.redis.set(key, JSON.stringify(activeModules));
                            
                            monitor.events(io, socket, ['emit'], {emit: 'resourceServer|branchCurModule', branchId, moduleId});
                            io.to(socket.id).emit('branchCurModule', branchId, moduleId);
                            
                        } catch (e) {
                            monitor.events(io, socket, ['on'], {on: 'resourceServer|branchCurModule', error: e});
                        }
                        
                    })
                }
                