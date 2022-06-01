const jwt = require('jsonwebtoken');

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

exports.socketCommunication = (io, socket) => {
    socket.on('resourceSubscribe', (resource, token) => {
        console.log(`Subscribe: ${resource} using token ${JSON.stringify(authenticateToken(token))}`);
    
        const auth = authenticateToken(token);

        if (!auth) {
            return sendToastMessage(io, socket, 'Unauthorized');
        }
    
        sendToastMessage(io, socket, 'Unauthorized');
    })
}