const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',      // Usuario por defecto de MySQL
    password: 'AgileRicky117.',      
    database: 'playtracker',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;