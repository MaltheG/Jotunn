const mysql = require("mysql");

const pool = mysql.createPool(process.env.DATABASE_URL);

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

        //Wrapper to convert old params format with $1, $2, etc., to new format: ?, ?
        //The old one is better, but mysql uses the other one

        let newText = "";
        let newParams = [];

        let strArr = text.split("$")
        newText += strArr[0];

        for(let i = 1; i < strArr.length; i++) {
            let str = strArr[i];
            let index = parseInt(str[0]);
            
            newParams.push(params[index - 1]);

            newText += "?" + str.slice(1);
        }
        

        return new Promise((resolve, reject) => {
            pool.query(newText, newParams, (err, rows) => {
                if (err) return reject(err);
                return resolve({rows: rows});
            })
        })
    }
}