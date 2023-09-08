// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits, Message } = require('discord.js');
const { globalPrefix, token } = require('./config.json');
const { wordsToNumbers } = require('words-to-numbers');
const { evaluate } = require('mathjs');
const { Database, OPEN_READWRITE } = require('sqlite3');
const Keyv = require('keyv');
const keyv = new Keyv({ serialize: JSON.stringify, deserialize: JSON.parse });
//const prefixes = new Keyv('sqlite://path/to.sqlite');
const scp = require('node-scp');
const fs = require('fs');
const usetube = require('usetube')
const path = require("path");

var remote_server = {
    host: '150.230.169.222', // host ip
    port: 22, //port used for scp
    username: 'opc', //username to authenticate
    privateKey: fs.readFileSync('./ssh.key'),
}

var jermaFiles;
scp.Client(remote_server)
    .then(client => {
        client.list('/home/opc/mediaHosting/jermaSFX/').then(x => {
            jermaFiles = x;
            Object.freeze(jermaFiles);
        });
    }).catch(error => console.log(error));

var jermaClips;
usetube.getPlaylistVideos('PLBasdKHLpmHFYEfFCc4iCBD764SmYqDDj')
    .then(x => {
        jermaClips = x;
        console.log(jermaClips);
        Object.freeze(jermaClips);
    }).catch(error => console.log(error));


const persistPath = "./persistence/persist.db";
const usersPath   = "./persistence/users.db";
var db;

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.AutoModerationConfiguration,
        GatewayIntentBits.AutoModerationExecution
    ]
});

String.prototype.insert = function(index, string) {
    if (index > 0) {
        return this.substring(0, index) + string + this.substring(index, this.length);
    }

    return string + this;
};

Message.prototype.replyTo = function(reply, ping = true) {
    try {
        reply = reply.toString();
        return this.reply({ content: reply, allowedMentions: { repliedUser: ping } });
    } catch (error) {
        console.error(error);
    }
};

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

// typeFrom will mean you can convert from seconds to minutes, hours to ms, minutes to days, etc.
// for now it defaults to milliseconds
function convertTime(time, typeTo, typeFrom = 'ms') {
    typeFrom = typeToNum(typeFrom);
    typeTo = typeToNum(typeTo);
    function typeToNum(from){
        switch (from) {
            case 's': return 1;
            case 'm': return 2;
            case 'h': return 3;
            case 'd': return 4;
            default:  return 0;
        }
    }
    if (typeFrom === typeTo) return time;
    if (typeTo < typeFrom) {
        switch (true) {
            case typeTo <= 0: // ms, don't do anything
            case typeTo <= 1: time /= 1000;
            case typeTo <= 2: time /= 60;
            case typeTo <= 3: time /= 60;
            case typeTo <= 4: time /= 24;
            break;
        }
    } else {
        switch (true) {
            case typeTo >= 4: // days, don't do anything
            case typeTo >= 3: time *= 24;
            case typeTo >= 2: time *= 60;
            case typeTo >= 1: time *= 60;
            case typeTo >= 0: time *= 1000;
            break;
        }
    }
    console.log(`currently waiting for ${time} ${typeTo}`);
    return time;
}

class Command {
    constructor(genre, commandName, desc, func, params = [], limitedTo = []) {
        this.genre = genre;
        this.commandName = commandName;
        this.desc = desc;
        this.func = func;
        this.params = params;
        this.limitedTo = limitedTo;
    }
}

class Param {
    constructor(name, desc, preset) {
        this.name = name;
        this.desc = desc;
        this.preset = preset;
    }
}

const commands = [
    //help
    new Command("bot/support", "help", "lists all commands", async function(message, parameters) {
        let response = "";
        function addToHelp(com) {
            response += `$${com.commandName} (`;
            for (let i = 0; i < com.params.length; i++) {
                let name = com.params[i].name;
                response += i === com.params.length - 1 ? name : `${name}, `;
            }
            response += `) : ${com.desc} \n`;
            if (parameters["paramDescs"]) {
                for (let i = 0; i < com.params.length; i++) {
                    response += `-${com.params[i].name} : ${com.params[i].desc} \n`;
                }
            }
        }
        try {
            if (Boolean(parameters["whichCommand"])) {
                addToHelp(commands.find(x => x.commandName === parameters["whichCommand"]));
            } else {
                commands.forEach(x => addToHelp(x));
            }
        } catch (error) {
            message.replyTo(`${parameters["whichCommand"]} is NOT a command. try again :/`)
        }

        message.replyTo(response);
    }, [
        new Param("paramDescs", "include parameter descriptions", false),
        new Param("whichCommand", "will return help for a specific command", ""),
        new Param("debugMode", "idk what this does yet lol", false),
    ], []),

    //eval
    new Command("general/fun", "math", "does the math put in front of it", async function(message, parameters) {
        try {
            message.replyTo(String(evaluate(parameters["equation"])));
        } catch (error) {
            message.replyTo(error);
        }
    }, [
        new Param("equation", "the equation to be evaluated", "undefined"),
    ], []),

    // run
    new Command("general/fun", "eval", "astrl only!! runs javascript code from a string", async function(message, parameters) {
        try {
            let code = eval(parameters["code"]);
            if (parameters["return"]) {
                message.replyTo(String(code));
            }
        } catch (error) {
            message.replyTo(String(error));
        }
    }, [
        new Param("code", "the code to run", ""),
        new Param("return", "should the ", true),
    ], [ "438296397452935169" ]),

    // echo
    new Command("general/fun", "echo", "echoes whatever's in front of it", async function(message, parameters) {
        try {
            await sleep(parameters["waitValue"]);
            message.channel.send(parameters["reply"]);
            if (parameters["delete"]) message.delete();
        } catch (error) {
            message.channel.send(error);
        }
    }, [
        new Param("reply", "the message to echo back to you", "..."),
        new Param("waitValue", "the time it will take to echo back your message", 0),
        new Param("waitType", "i.e ms (milliseconds), s (seconds), m (minutes)", 's'),
        new Param("delete", "deletes message after sending", false),
    ], []),

    // mock
    new Command("general/fun", "mock", "mocks text/whoever you reply to", async function(message, parameters) {
        try {
            let reference = await message.fetchReference();
            mockFunc(reference, reference.content);
            message.delete();
        } catch (error) {
            mockFunc(message, parameters["reply"])
        }

        function mockFunc(reply, content) {
            const mock = [];
            for (let i = 0; i < content.length; i++) {
                let vary = i % 2 == 0;
                // if (parameters["variance"] !== 0) {
                //     let vary = i % 2 == 0;
                // }

                // let vary;
                // if (mock[i - 1] === mock[i - 1].toLowerCase()) {
                //     vary = ;
                // }
                mock.push(vary ? content[i].toLowerCase() : content[i].toUpperCase());
            }
            reply.replyTo(mock.join(''));
        }
    }, [
        new Param("reply", "the message to mock", "..."),
        new Param("variance", "the amount of variance in the mocking (INITIALIZATION ONLY)", 0),
    ], []),

    // jerma
    new Command("general/fun", "jerma", "sets the current channel to be the channel used for counting", async function(message, parameters) {
        console.log(parameters["fileType"]);
        switch (parameters["fileType"]) {
            case 0:
                scp.Client(remote_server)
                    .then(client => {
                        message.react('✅');
                        
                        let result = `./temp/${parameters["fileName"]}.mp3`;
                        let index = Math.round(Math.random() * jermaFiles.length - 1);
                        client.downloadFile(`/home/opc/mediaHosting/jermaSFX/${jermaFiles[index].name}`, result)
                            .then(response => {
                                message.channel.send({ files: [result] });
                                client.close();
                            }).catch(error => console.log(error));
                        }
                    ).catch(error => console.log(error));
                break;
            case 1:
                //index = Math.round(Math.random() * jermaClips.length - 1);
                console.log(jermaClips[0]);
                //message.replyTo(`https://youtu.be/${jermaClips[index].id}`)
                break;
            default:
                message.replyTo(`type "${parameters["fileType"]}" not supported!`);
                break;
        }
        

        function err(message, error)
        {
            message.react('✅');
            console.log(error);
        }
    }, [
        new Param("fileType", "the type of jerma file (INITIALIZATION ONLY)", 0),
        new Param("fileName", "the name of the resulting file", "jerma so silly"),
    ], []),

    // countHere
    new Command("patterns/counting", "countHere", "sets the current channel to be the channel used for counting", async function(message, parameters) {
        let channelId = parameters?.["channel"] ?? message.channel.id;
        let isChannel = count.channel === channelId;

        count.channel = isChannel ? "" : channelId;
        await client.channels.fetch(channelId)
            .then(x => x.send(isChannel ? 'counting in this channel has ceased.' : 'alright. start counting then.'))
            .catch(e => message.replyTo(e));
    }, [
        new Param("channel", "the specific channel to start counting in", "")
    ], [ "438296397452935169" ]),

    // resetCount
    new Command("patterns/counting", "resetCount", "resets the current count", async function(message, parameters) {
        resetNumber(message, 'reset the count!', '✅');
    }, [], [ "438296397452935169" ]),

    // chainHere
    new Command("patterns/chaining", "chainHere", "sets the current channel to be the channel used for message chains", async function(message, parameters) {
        let channelId = parameters?.["channel"] ?? message.channel.id;
        let isChannel = chain.channel === channelId;

        chain.channel = isChannel ? "" : channelId;
        await client.channels.fetch(channelId)
            .then(x => x.send(isChannel ? 'the chain in this channel has been eliminated.' : 'alright. start a chain then.'))
            .catch(e => message.replyTo(e));
    }, [
        new Param("channel", "the specific channel to start counting in", "")
    ], [ "438296397452935169" ]),

    // autoChain
    new Command("patterns/chaining", "autoChain", "will let any channel start a chain", async function(message, parameters) {
        chain.autoChain = parameters["howMany"];
        message.replyTo(`autoChain is now ${chain.autoChain}.`);
    }, [ new Param("howMany", "how many messages in a row does it take for the chain to trigger?", 4) ], [ "438296397452935169" ]),

    // kill
    new Command("bot", "kill", "kills the bot", async function(message, parameters) {
        message.channel.send('bot is now dead 😢');
        client.destroy();
    }, [],
    [
        "438296397452935169",
        "705120334705197076",
        "686222324860715014",
    ]),
];

// counting variables
const count = {
    channel     : "",
    currentNum  : 0,  // the last number said that was correct
    prevNumber  : 0,  // used to reset back to the last number if i messed up my code
    highestNum  : 0,  // the highest number ever gotten to
    lastCounter : "", // used to check for duplicates
}

// chain variables
const chain = {
    channel      : "", //
    currentChain : "", //
    chainAmount  : 0,  //
    prevChain    : "", //
    lastChainer  : "", //
    autoChain    : 0,  //
    chainFunc    : function(message, inRow) {
        console.log(this);
        console.log("first " + inRow);
        if (!this.currentChain) {
            this.currentChain = message.content.toLowerCase();
            this.chainAmount = 1;
            return;
        }
        if (message.content.toLowerCase() === this.currentChain && this.lastChainer !== message.author.id) {
            this.chainAmount++;
            if (this.chainAmount >= inRow) message.react('⛓️');
        } else {
            if (this.chainAmount >= inRow) message.react('💔');
            this.prevChain = this.currentChain;
            this.currentChain = message.content.toLowerCase();
            this.chainAmount = 1;
        }
        this.lastChainer = message.author.id;
        console.log(this);
        console.log(inRow);
    }
}

// blacklist list, the function to push to it will be blacklist()
const bl = [];

async function resetNumber(message, reply = 'empty. astrl screwed up lol', react = '💀')
{
    if (count.currentNum > count.highestNum) count.highestNum = count.currentNum;
    count.lastCounter = '';
    count.prevNumber = count.currentNum;
    count.currentNum = 0;
    message.react(react);
    await message.replyTo(reply);
}

// keyv stuff
keyv.on('error', err => console.error('Keyv connection error:', err));

function createDatabase() {
    var newdb = new Database(persistPath, (err) => {
        if (err) {
            console.error("Getting error " + err);
            exit(1);
        }
        createTables(newdb);
    });
}

function createTables(newdb) {
    newdb.exec(`
    create table user (
        user_id text primary key not null,
        user_name text not null,
        count_screws int not null,
        chain_screws int not null,
    );
    insert into user (user_id, user_name, count_screws, chain_screws)
        values (1, 'Spiderman', 'N', 'Y'),
               (2, 'Tony Stark', 'N', 'N'),
               (3, 'Jean Grey', 'Y', 'N');

    create table hero_power (
        hero_id int not null,
        hero_power text not null
    );

    insert into hero_power (hero_id, hero_power)
        values (1, 'Web Slinging'),
               (1, 'Super Strength'),
               (1, 'Total Nerd'),
               (2, 'Total Nerd'),
               (3, 'Telepathic Manipulation'),
               (3, 'Astral Projection');
        `, ()  => {
            runQueries(newdb);
    });
}

function runQueries(db) {
    db.all(`select hero_name, is_xman, was_snapped from hero h
   inner join hero_power hp on h.hero_id = hp.hero_id
   where hero_power = ?`, "Total Nerd", (err, rows) => {
        rows.forEach(row => {
            console.info(row.hero_name + "\t" +row.is_xman + "\t" +row.was_snapped);
        });
    });
}

// when the client is ready, run this code
client.once(Events.ClientReady, c => {
    // new Database(persistPath, OPEN_READWRITE, (err) => {
    //     if (err && err.code == "SQLITE_CANTOPEN") {
    //         createDatabase();
    //         return;
    //     } else if (err) {
    //         console.log("Getting error " + err);
    //         exit(1);
    //     }
    //     runQueries(db);
    // });
	console.info(`Ready! Logged in as ${c.user.tag}`);

    // try {
    //     saveData = JSON.parse(fs.readFileSync('./save-data.json', 'utf8')); // Load save data
    // } catch(e) {
    //     // Init if no save data found
    //     saveData = new SaveData();
    // }
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    let cont = message.content;

    for (let i = 0; i < commands.length; i++) {
        let com = commands[i];

        if (("$"+com.commandName.toLowerCase()) === message.content.split(' ')[0].toLowerCase()) {
            if (com.limitedTo.length === 0 || com.limitedTo.includes(message.author.id)) {
                // parameter stuff
                let paramObj = {};
                const space = '|'; // for consistency; will always use the same character(s) for replacing spaces
                let tempParameters;
                if (Boolean(message.content.split(' ')[1])) {
                    let sections = message.content.split('"');
                    if (message.content.includes('"')) {
                        for (let i = 0; i < sections.length; i++) {
                            if (i % 2 == 1 && sections[i].includes(' ')) {
                                sections[i] = sections[i].split(' ').join(space);
                            }
                        }
                    }
                    tempParameters = sections.join('').split(' ');
                    tempParameters.shift();

                    let j = 0;
                    for (let i = 0; i < Math.min(tempParameters.length, com.params.length); i++) {
                        // god i miss conditional statements
                        function convParam(param, content) {
                            switch ((typeof param.preset).toLowerCase()) {
                                case "string": return String(content);
                                case "number": return Number(content);
                                case "boolean": return (content.toLowerCase() == "true") ? true : false;
                                default: 
                                console.error("uh oh!! that's not real.")
                                return undefined;
                            }
                        }
                        // convert parameter back to spaces, if it needs them
                        if (tempParameters[i].includes(space)) {
                            tempParameters[i] = tempParameters[i].split(space).join(' ');
                        }
                        // decides if the current param is being manually set or not, and assigns the paramObj accordingly
                        if (tempParameters[i].includes(':')) {
                            let halves = tempParameters[i].split(':');
                            let param = com.params.find(x => x.name === halves[0]);
                            
                            if (Boolean(param)) {
                                paramObj[halves[0]] = convParam(param, halves[1]) ?? param.preset;
                            }
                        } else {
                            paramObj[com.params[j].name] = convParam(com.params[j], tempParameters[i]);
                            j++;
                        }
                    }
                }

                // if parameter is not set, use the preset
                com.params.forEach(x => {
                    if (!paramObj.hasOwnProperty(x.name)) {
                        paramObj[x.name] = x.preset;
                    }
                });

                try {
                    com.func(message, paramObj);
                } catch (error) {
                    message.replyTo(error);
                }
            } else {
                await message.replyTo('hey, you can\'t use this command!');
            }
            return;
        }
    }

    if (message.channel.id === count.channel) {
        var num = 0;

        var content = String(wordsToNumbers(message.content));

        var matches = content.match('|');
        if (matches == undefined) {
            matches = content.match('/\d+/');
        }
        try {
            num = evaluate(content.substring(0, matches[matches.length - 1]));
        } catch (error) {
            if (!isNaN(content[0])) {
                try {
                    num = parseInt(content);
                } catch (error) {
                    message.replyTo('yeah that doesn\'t work. sorry \n' + error);
                }
            }
            return;
        }

        if (count.lastCounter === message.author.id) {
            resetNumber(message, 'uhhh... you know you can\'t count twice in a row, right??');
            return;
        }

        if (num == count.currentNum + 1) {
            message.react('✅');
            count.lastCounter = message.author.id;
            count.currentNum++;
        } else {
            resetNumber(message, (count.prevNumber < 10) ?
                'you can do better than THAT...' :
                'you got pretty far. but i think you could definitely do better than ' + count.highestNum + '.'
            );
        }
    } else if (message.channel.id === chain.channel) {
        chain.chainFunc(message, 3);
    } else if (chain.autoChain >= 0) {
        //chain.chainFunc(message, chain.autoChain);
    }
});

// Log in to Discord with your client's token
client.login(token);