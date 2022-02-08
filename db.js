const {Pool} = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true,
});

/*
user: "postgres",
host: "localhost",
database: "JotunnDev",
password: "admin",
port: "5432",
*/

module.exports = {
    query: (text, params, callback) => {
        return pool.query(text, params, callback)
    }
}