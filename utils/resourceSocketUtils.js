const jwt = require('jsonwebtoken');
const debug = require('../utils/debugUtils');
const db = require('../database/database-interface');
const server = require('../server.js');

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
    socket.join(resourceId);

    let dbMessage = {
        p: 'resourceSocketUtils.js subscribeToTree',
        resourceId
    }
    io.to(socket.id).emit('debugEvent', 'subscribeToTree', dbMessage);

    const key = `${resourceId}:branchOrder`;
    const ts = Date.now();
    const focus = null;

    const redisVal = await db.redis.hGet(key, 'redisVal');
    io.to(socket.id).emit('debugEvent', 'subscribeToTree', {key, redisVal});

    if (Object.keys(redisVal).length) {
        return io.to(socket.id).emit('branchOrder', resourceId, redisVal, focus, socket.id);
    }


    const sql = `SELECT branch_order FROM trees WHERE tree_id=${esc(resourceId)}`;
    let branchOrder;
    try {
        branchOrder = await db.pquery(sql);
        if (!branchOrder || !branchOrder.length) return sendToastMessage(io, socket, "Database Error 5001: Please try again later.");
    } catch (e) {
        debug.d(e);
        return sendToastMessage(io, socket, "Database Error 5002: Please try again later.");
    }
    
    dbMessage = {
       p : 'resourceSocketUtils.js subscribeToTree',
       resourceId,
       branchOrder: branchOrder[0].branch_order,
       focus,
       sender : socket.id
    }
    io.to(socket.id).emit('debugEvent', 'subscribeToTree', dbMessage);

    io.to(socket.id).emit('branchOrder', resourceId, branchOrder[0].branch_order, focus, socket.id);
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

const setBranchName = async (branchId, branchName, treeId, anscestors, io, socket) => {
    const p = fn + 'setBranchName'
    const key = `${branchId}:branchName`;
    const ts = Date.now();
   
    try {
        db.redis.hSet(key, 'redisVal', branchName);
        db.redis.hSet(key, 'accessed', ts);

        // TODO: create function to broadcast to tree and ancestors
        // TODO: update sql database intermittently in case of server failure. See above.

        let dbMessage = {
            p, branchId, treeId
        }
        io.to(socket.id).emit('debugEvent', 'branchNameChange', dbMessage);
        io.to(treeId).emit('setBranchName', branchId, branchName, socket.id);

    } catch (e) {
        console.error(e);
    }
}

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

const getInitialBranchName = async (branchId, treeId, ancestors, io, socket) => {
    const key = `${branchId}:branchName`;
    const ts = Date.now();
    let redisResult = null;
    const p = 'resourceSocketUtils.js getInitialBranchName';

    let dbMessage = {
        p,
        branchId,
        treeId
    }
    io.to(socket.id).emit('debugEvent', 'subscribeToTree', dbMessage);

    try {
        const value = await db.redis.hGetAll(key);
        if (value) {
            dbMessage = {
                redisResult: value
            }
            io.to(socket.id).emit('debugEvent', 'subscribeToTree', dbMessage);

            db.redis.hSet(key, 'accessed', ts);
            io.to(socket.id).emit('getInitialBranchName', branchId, value.redisVal, socket.id);
        }
        else {
            const sql = `SELECT branch_name FROM branches WHERE branch_id = ${esc(branchId)}`;
            
            io.to(socket.id).emit('debugEvent', 'subscribeToTree', sql);

            const dbResult = await db.pquery(sql);
            const branchName = dbResult[0].branch_name;
           
            const fields = {
                accessed: ts,
                redisVal: branchName,
                mysqlVal: branchName,
                state: 'active' // can change to middle value and then delete if no change since middle value
            }
            let test = db.redis.hSet(key, fields);
    
            io.to(socket.id).emit('getInitialBranchName', branchId, branchName, socket.id);
        }
    } catch(e) {
        console.error(e);
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

    socket.on('setBranchName', (branchId, branchName, treeId, anscestors, token, permissions = null) => {
        if (!authenticateResource(branchId, token, io, socket, permissions)) return;
        
        let dbMessage = {
            p: 'resourceSocketUtils.js on setBranchName',
            branchId,
            branchName,
            treeId
        }
        io.to(socket.id).emit('debugEvent', 'branchNameChange', dbMessage);

        setBranchName(branchId, branchName, treeId, anscestors, io, socket);
    });

    socket.on('getBranchName', (branchId, treeId, ancestors, token, permissions = null) => {
        if (!authenticateResource(branchId, token, io, socket, permissions)) return;
        getBranchName(branchId, treeId, ancestors, io, socket);
        console.log("on getBranchName");
    })

    socket.on('getInitialBranchName', (branchId, treeId, ancestors, token, permissions = null) => {
        if (!authenticateResource(branchId, token, io, socket, permissions)) return;
        let dbMessage = {
            p: 'resourceSocketUtils.js on getInitialBranchName',
            branchId,
            treeId
        }
        io.to(socket.id).emit('debugEvent', 'subscribeToTree', dbMessage);
        getInitialBranchName(branchId, treeId, ancestors, io, socket);
        
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
       db.pquery('SELECT module_name, icon FROM modules')
       .then(data => {
         io.to(socket.id).emit('getAllModules', data);
       })
       .catch(err => {
        console.error(err);
       })
        
    } ); 

}