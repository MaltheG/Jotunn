const mysql = require("mysql");

const pool = mysql.createPool({
    connectionString: process.env.DATABASE_URL,
    //ssl: {rejectUnauthorized: false},
});

/*
user: "postgres",
host: "localhost",
database: "JotunnDev",
password: "admin",
port: "5432",

DATABASE_URL=postgressql://postgres:admin@localhost:5432/JotunnDev JOTUNN_TOKEN=NzY5NzA5Mzc3Mzg0MDg3NTcy.X5S9uA.k975j_t2ZS0zQwUhq-nbTwDGHsE node index.js
*/

module.exports = {
    query: (text, params, callback) => {
        return pool.query(text, params, callback)
    }
}