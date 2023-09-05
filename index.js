// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits, GuildChannel, Emoji, PartialGroupDMChannel } = require('discord.js');
const { globalPrefix, token } = require('./config.json');
const { wordsToNumbers } = require('words-to-numbers');
const { evaluate } = require('mathjs');
const { Database, OPEN_READWRITE } = require('sqlite3');
const Keyv = require('keyv');
const keyv = new Keyv({ serialize: JSON.stringify, deserialize: JSON.parse });
//const prefixes = new Keyv('sqlite://path/to.sqlite');

const persistPath = "./persistence/persist.db";
const usersPath   = "./persistence/users.db";
var db;

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
    ]
});

String.prototype.insert = function(index, string) {
    if (index > 0) {
        return this.substring(0, index) + string + this.substring(index, this.length);
    }

    return string + this;
};

// class Person {
//     constructor(userId, strikes, desc) {
//         this.userId = userId;
//         this.strikes = strikes;
//         this.desc = desc;
//     }
// }

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

// class SaveData {
//     constructor(currentNumber, prevNumber, highestNumber, lastCounter, currentChain, chainAmount, prevChain, lastChainer, countingChannel, chainChannel) {
//         // counting stuff
//         this.currentNumber = currentNumber;
//         this.prevNumber = prevNumber;
//         this.highestNumber = highestNumber;
//         this.lastCounter = lastCounter;
//         // chain stuff
//         this.currentChain = currentChain;
//         this.chainAmount = chainAmount;
//         this.prevChain = prevChain;
//         this.lastChainer = lastChainer;
//         // channel persistence
//         this.countingChannel = countingChannel;
//         this.chainChannel = chainChannel;
//     }
// }

// function replaceAll(str1, str2, ignore) 
// {
//     return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g,"\\$&"),(ignore?"gi":"g")),(typeof(str2)=="string")?str2.replace(/\$/g,"$$$$"):str2);
// }

function noPingReply(message, reply) {
    message.reply({ content: reply, allowedMentions: { repliedUser: false } });
}

const commands = [
    //help
    new Command("bot/support", "help", "lists all commands", function(message, parameters) {
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
            noPingReply(message, ``)
        }
        
        noPingReply(message, response);
    }, [
        new Param("paramDescs", "include parameter descriptions", false),
        new Param("whichCommand", "will return help for a specific command", ""),
        new Param("debugMode", "idk what this does yet lol", false),
    ], []),

    //eval
    new Command("general/fun", "math", "does the math put in front of it", function(message, parameters) {
        var math = '';
        try {
            math = evaluate(parameters["equation"]);
        } catch (error) {
            math = error;
        }
        noPingReply(message, String(math));
    }, [
        new Param("equation", "the equation to be evaluated", ""),
        //new Param("return", "should the ", ""),
    ], []),

    // run
    new Command("general/fun", "eval", "astrl only!! runs javascript code from a string", function(message, parameters) {
        var code = '';
        try {
            code = eval(parameters["code"]);
            if (parameters["return"]) noPingReply(message, String(code));
        } catch (error) {
            noPingReply(message, String(error));
        }
    }, [
        new Param("code", "the code to run", ""),
        new Param("return", "should the ", true),
    ], [ "438296397452935169" ]),
    
    // echo
    new Command("general/fun", "echo", "echoes whatever's in front of it", function(message, parameters) {
        let reply = "something broke";
        try {
            reply = parameters["reply"];
            message.channel.send(reply);
        } catch (error) {
            message.channel.send(error);
        }
    }, [
        new Param("reply", "the message to echo back to you", "..."),
    ], []),
    
    // countHere
    new Command("patterns/counting", "countHere", "sets the current channel to be the channel used for counting", function(message, parameters) {
        let isChannel = count.channel === message.channel.id

        count.channel = isChannel ? "" : message.channel.id;
        message.channel.send(isChannel ? 'counting in this channel has ceased.' : 'alright. start counting then.')
    }, [], [ "438296397452935169" ]),
    
    // resetCount
    new Command("patterns/counting", "resetCount", "resets the current count", function(message, parameters) {
        resetNumber(message, 'reset the count!', '✅');
    }, [], [ "438296397452935169" ]),

    // chainHere
    new Command("patterns/chaining", "chainHere", "sets the current channel to be the channel used for message chains", function(message, parameters) {
        let isChannel = chain.channel === message.channel.id

        count.channel = isChannel ? "" : message.channel.id;
        message.channel.send(isChannel ? 'the chain in this channel has been eliminated.' : 'alright. start a chain then.')
    }, [

    ], [ "438296397452935169" ]),

    // autoChain
    new Command("patterns/chaining", "autoChain", "will let any channel start a chain", function(message, parameters) {
        
    }, [ new Param("howMany", "how many messages in a row does it take for the chain to trigger?", 4) ], [ "438296397452935169" ]),
    
    new Command("bot", "kill", "kills the bot", function(message, parameters) {
        message.channel.send('bot is now dead 😢');
        client.destroy();
    }, [], 
    [
        "438296397452935169",
        "705120334705197076",
        "686222324860715014",
    ]),
    
    new Command("bot", "test", "kills the bot", function(message, parameters) {
        message.channel.send('bot is now dead 😢');
        client.destroy();
    }, [
        new Param("secondTest", "", "")
    ], 
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
    await message.reply(reply);
}

// keyv stuff
keyv.on('error', err => console.error('Keyv connection error:', err));

function createDatabase() {
    var newdb = new Database(persistPath, (err) => {
        if (err) {
            console.log("Getting error " + err);
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
            console.log(row.hero_name + "\t" +row.is_xman + "\t" +row.was_snapped);
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
	console.log(`Ready! Logged in as ${c.user.tag}`);
    
    // try {
    //     saveData = JSON.parse(fs.readFileSync('./save-data.json', 'utf8')); // Load save data
    // } catch(e) {
    //     // Init if no save data found
    //     saveData = new SaveData();
    // }
});

client.on(Events.MessageCreate, async (message, content) => {
    if (message.author.bot) return;
    let cont = message.content;
    console.log(content);

    for (let i = 0; i < commands.length; i++) {
        let com = commands[i];

        if (("$"+com.commandName) === message.content.split(' ')[0]) {
            if (com.limitedTo.length === 0 || com.limitedTo.includes(message.author.id)) {
                // parameter stuff
                let paramObj = {};
                if (message.content.split(' ')[1] !== null) {
                    let sections = message.content.split('"');
                    if (message.content.includes('"')) {
                        for (let i = 0; i < sections.length; i++) {
                            if (i % 2 == 1 && sections[i].includes(' ')) {
                                sections[i] = sections[i].split(' ').join('');
                            }
                        }
                    }
                    let tempParameters = sections.join('').split(' ');
                    tempParameters.shift();

                    let j = 0;
                    for (let i = 0; i < tempParameters.length; i++) {
                        if (tempParameters[i].includes(':') && com.params.forEach(x => x.name === tempParameters[i].split(':')[0])) {
                            paramObj[tempParameters[i].split(':')[0]] = convParam(com.params[i]);
                        } else {
                            paramObj[com.params[j].name] = convParam(com.params[j]);
                            j++;
                        }
    
                        function convParam(param) {
                            switch ((typeof param.preset).toLowerCase()) {
                                case "string": return String(tempParameters[i]);
                                case "number": return Number(tempParameters[i]);
                                case "boolean": return (tempParameters[i].toLowerCase() == "true") ? true : false;
                                default: throw "Unsupported type";
                            }
                        }
                    }
                }

                for (let i = 0; i < com.params.length; i++) {
                    let param = com.params[i];
                    if (paramObj[param.name] === null) {
                        paramObj[param.name] = param.preset;
                    } 
                }
                
                com.func(message, paramObj);
            } else {
                await message.reply('hey, you can\'t use this command!');

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
                    message.reply('yeah that doesn\'t work. sorry \n' + error);
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
        if (!chain.currentChain) {
            chain.currentChain = message.content.toLowerCase();
            chain.chainAmount = 1;
            return;
        }
        if (message.content.toLowerCase() === chain.currentChain && chain.lastChainer !== message.author.id) {
            chain.chainAmount++;
            if (chain.chainAmount >= 3) message.react('⛓️');
        } else {
            if (chain.chainAmount >= 3) message.react('💔');
            chain.currentChain = message.content.toLowerCase();
            chain.chainAmount = 1;
        }
        lastChainer = message.author.id;
    }
});

// Log in to Discord with your client's token
client.login(token);