require('dotenv').config();
const redisPackage = require('redis');
const redis = redisPackage.createClient();

const MAX_INDEX = 1;
const WAIT_TIME = 5;

const mysqlOptions = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    charset: 'utf8'
};

console.log(mysqlOptions);

const mysqlPackage = require('mysql');
const mysql = mysqlPackage.createConnection(mysqlOptions);

const esc = val => mysql.escape(val, true);

const sqlQuery = async sql => {
    return (new Promise((resolve, reject) => {
        mysql.query(sql, (error, result) => error ? reject(error) : resolve(result))
    }))
};

mysql.connect(error => {
    if (error) return console.error(error);

    console.log ('mysql connected!');

})

const updateBranchName = async (branchId, branchName) => {
    const sql = `UPDATE branches SET branch_name=${esc(branchName)} WHERE branch_id=${esc(branchId)}`;
    console.log('awaiting sqlquery');
    const result = await sqlQuery(sql);
    console.log('awaiting redis.set');
    await redis.set(`db:${branchId}:branchName`, branchName);
}

const branchName = async branchId => {
    let dbVal = await redis.get(`db:${branchId}:branchName`);
    let branchName = await redis.get(`${branchId}:branchName`);

    console.log('branchName', branchName, 'dbVal', dbVal);

    if (!branchName) branchName = '';

    if (!dbVal) return await updateBranchName(branchId, branchName);
    if (dbVal === branchName) return;
    await updateBranchName(branchId, branchName);
}

redis.on('connect', async () => {
    console.log('redis connected!');
    let keys = [];
    let uniqueKeys = [];
    let dbVal;
    let parts = [];

    while(1) {
        // get the next 1000 items that need preserving 
        keys = await redis.lRange('rcache', 0, MAX_INDEX);
        console.log('keys', keys);

        if (!keys || !keys.length) {
            console.log(`waiting ${WAIT_TIME} seconds`);
            await new Promise(resolve => setTimeout(resolve, WAIT_TIME * 1000));
        } else {
            uniqueKeys = [...new Set(keys)];
        
            for (let i = 0; i < uniqueKeys.length; ++i) {
                parts = uniqueKeys[i].split(':');

                switch (parts[1]) {
                    case 'branchName':
                        await branchName(parts[0]);
                        break;

                    default:
                        console.error(`Unknown key label: ${parts[1]}`);
                }
            }

            await redis.lTrim('rcache', MAX_INDEX + 1, -1);
        }
    }
    
});

redis.connect();
