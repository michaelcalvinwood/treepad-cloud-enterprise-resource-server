const jwt = require('jsonwebtoken');
const debug = require('../utils/debugUtils');
const db = require('../database/database-interface');
const server = require('../server.js');

/* Database Error Codes
    5001: No branch_order found in trees for tree_id
    5002: Database error when trying to select branch_order from tree_id
*/

const esc = val => {
    return server.dbPool.escape(val, true);
}


const authenticateToken = token => {
    if (!token) return false;

    const verified = jwt.verify(token, process.env.SECRET_KEY);

    if (!verified ) return false;
  
    return jwt.decode(token);
}

const sendToastMessage = (io, socket, message) => {
    console.log(`Sending toast: ${message}`);
    io.to(socket.id).emit('toastMessage', message);
    
}

const subscribeToTree = async (io, socket, resourceId, token) => {
    console.log(`subscribeToTree: ${resourceId}`);
    const sql = `SELECT branch_order FROM trees WHERE tree_id=${esc(resourceId)}`;
    let branchOrder;
    try {
        branchOrder = await db.pquery(sql);
        debug.d(branchOrder, branchOrder);
        if (!branchOrder || !branchOrder.length) return sendToastMessage(io, socket, "Database Error 5001: Please try again later.");
    } catch (e) {
        debug.d(e);
        return sendToastMessage(io, socket, "Database Error 5002: Please try again later.");
    }
    socket.join(resourceId);
    console.log('emit branchOrder', branchOrder[0].branch_order);
    io.to(socket.id).emit('branchOrder', branchOrder[0].branch_order);
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

    return true;
}

exports.socketCommunication = (io, socket) => {
    socket.on('resourceSubscribe', (resourceId, token) => {
        console.log(`on resourceSubscribe: ${resourceId} using token ${JSON.stringify(authenticateToken(token))}`);

        const resource = getResourceParts(resourceId, io, socket);
        if (!resource) return;

        if (!authenticate(resource, token, io, socket)) return;
    
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

    socket.on('setBranchName', (branchId, branchName, treeId, anscestors, token) => {
        console.log('socket setBranchName', branchId, branchName);        const resource = getResourceParts(branchId, io, socket);
        if (!resource) return;

        if (!authenticate(resource, token, io, socket)) return;

        const sql = `UPDATE branches SET branch_name=${esc(branchName)} WHERE branch_id=${esc(branchId)}`;

        db.pquery(sql)
        .then(data => {
            io.to(treeId).emit('branchName', branchId, branchName, socket.id);
        })
        .catch(err => {
            console.log(err);
            sendToastMessage(io, socket, 'Database Error: Please try again later.')
        })

        
    });
}