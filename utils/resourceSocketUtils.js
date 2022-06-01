const jwt = require('jsonwebtoken');
const debug = require('../utils/debugUtils');
const db = require('../database/database-interface');

/* Database Error Codes
    5001: No branch_order found in trees for tree_id
    5002: Database error when trying to select branch_order from tree_id
*/


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
    const sql = `SELECT branch_order FROM trees WHERE tree_id=${db.esc(resourceId)}`;
    let branchOrder;
    try {
        branchOrder = await db.pquery(sql);
        debug.pretty(branchOrder);
        if (!branchOrder || !branchOrder.length) return sendToastMessage(io, socket, "Database Error 5001: Please try again later.");
    } catch (e) {
        return sendToastMessage(io, socket, "Database Error 5002: Please try again later.");
    }
    io.to(socket.id).emit('branchOrder', branchOrder[0].branch_order);
}

const subscribeToBranch = (io, socket, resourceId, token) => {
    sendToastMessage(io, socket, 'Branch subscription coming soon')
}

const subscribeToLeaf = (io, socket, resourceId, token) => {
    sendToastMessage(io, socket, 'Leaf subscription coming soon');
    
}


exports.socketCommunication = (io, socket) => {
    socket.on('resourceSubscribe', (resourceId, token) => {
        console.log(`Subscribe: ${resourceId} using token ${JSON.stringify(authenticateToken(token))}`);
    
        const auth = authenticateToken(token);

        if (!auth) return sendToastMessage(io, socket, 'Invalid Token');
        
        const resourceIdParts = resourceId.split('_');

        //debug.pretty(resourceIdParts);
        const resource = {
            type: resourceIdParts[0],
            owner: resourceIdParts[1],
            uuid: resourceIdParts[2]
        }

        debug.pretty(resource);

        if (auth.userId !== Number(resource.owner)) return sendToastMessage(io, socket, 'Unauthorize'); 
    
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
}