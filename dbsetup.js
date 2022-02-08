const {Client} = require("pg")

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {rejectUnauthorized: false},
})

module.exports = async function init(){
    client.connect();

    client.query(`CREATE TABLE IF NOT EXISTS history (
        namer varchar(255),
        nickname varchar(255),
        time timestamp,
        userid varchar(255)
    );`)
        .then(res => {
            console.log(res);
        }).catch(err => {
        console.log(err);
    });

    client.query(`CREATE TABLE IF NOT EXISTS songHistory (
        songName varchar(255),
        songUrl varchar(1023),
        songID varchar(255) NOT NULL,
        guildID varchar(255) NOT NULL,
        userID varchar(255) NOT NULL,
        requests integer,plays integer,
        CONSTRAINT PK_SongRequest PRIMARY KEY (songID, guildID, userID)
    );`)
        .then(res => {
            console.log(res);
        }).catch(err => {
        console.log(err);
    })

    client.query(`CREATE TABLE IF NOT EXISTS commands (
        command varchar(255) NOT NULL,
        guildID varchar(255) NOT NULL,
        userID varchar(255),
        location varchar(1023),
        CONSTRAINT PK_GuildCommand PRIMARY KEY (command, guildID)
    );`)
        .then(res => {
            console.log(res);
        }).catch(err => {
        console.log(err);
    })
}
