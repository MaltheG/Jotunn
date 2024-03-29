const mysql = require("mysql");

const client = mysql.createConnection(process.env.DATABASE_URL);
    //ssl: {rejectUnauthorized: false},

module.exports = async function init(){
    client.connect();

    client.query(`CREATE TABLE IF NOT EXISTS history (
        namer varchar(255),
        nickname varchar(255),
        time timestamp,
        userid varchar(255)
    );`, (err, result) => {
        if (err) console.log(err)
    });

    client.query(`CREATE TABLE IF NOT EXISTS songHistory (
        songName varchar(255),
        songUrl varchar(1023),
        songID varchar(255) NOT NULL,
        guildID varchar(255) NOT NULL,
        userID varchar(255) NOT NULL,
        requests integer DEFAULT 0, plays integer DEFAULT 0,
        CONSTRAINT PK_SongRequest PRIMARY KEY (songID, guildID, userID)
    );`, (err, result) => {
        if (err) console.log(err)
    });

    client.query(`CREATE TABLE IF NOT EXISTS commands (
        command varchar(255) NOT NULL,
        guildID varchar(255) NOT NULL,
        userID varchar(255),
        location varchar(1023),
        CONSTRAINT PK_GuildCommand PRIMARY KEY (command, guildID)
    );`, (err, result) => {
        if (err) console.log(err)
    });

    client.query(`CREATE TABLE IF NOT EXISTS casino (
        guildID varchar(255) NOT NULL,
        userID varchar(255) NOT NULL,
        balance integer DEFAULT 0,
        loss integer DEFAULT 0,
        win integer DEFAULT 0,
        gifted integer DEFAULT 0,
        received integer DEFAULT 0,
        CONSTRAINT PK_GuildUser PRIMARY KEY (guildID, userID)
    );`, (err, result) => {
        if (err) console.log(err)
    });

    client.end();
}
