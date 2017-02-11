"use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var Quagga = require('quagga').default;
var Promise = require('bluebird');
var request = require('request-promise').defaults({ encoding: null });
var http = require('http')


var options = {
  host: 'jarvis-mesper-api.cloudapp.net',
  port: 80
};



var dotenv = require('dotenv');
dotenv.load();

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

var bot = new builder.UniversalBot(connector);

var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'api.projectoxford.ai';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v1/application?id=' + luisAppId + '&subscription-key=' + luisAPIKey;

// Main dialog with LUIS
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var intents = new builder.IntentDialog({ recognizers: [recognizer] })
/*
.matches('<yourIntent>')... See details at http://docs.botframework.com/builder/node/guides/understanding-natural-language/
*/
.matches('None', (session, args) => {
    session.send('Hi! This is the None intent handler. You said: \'%s\'.', session.message.text);
})
.matches('GetProduct', (session, args) => {
    session.send('Seems you want to get a product --> %s', args.entities[0].entity);
    console.log(args);
})
.matches('GetIngredient', (session, args) => {
    session.send('Now you want the ingredients, I see --> \'%s\'', args);
})

.onDefault((session) => {


    if (hasImageAttachment(session)) {
        session.send('You sent me a picture! good job for a retard');
        var msg = session.message;
        if (msg.attachments.length) {

            // Message with attachment, proceed to download it.
            // Skype & MS Teams attachment URLs are secured by a JwtToken, so we need to pass the token from our bot.
            var attachment = msg.attachments[0];
            var fileDownload = checkRequiresToken(msg)
                ? requestWithToken(attachment.contentUrl)
                : request(attachment.contentUrl);

            fileDownload.then(
                function (response) {


                    console.log(response);
                    // Send reply with attachment type & size
                    var reply = new builder.Message(session)
                        .text('Attachment of %s type and size of %s bytes received.', attachment.contentType, response.length);

                    session.send(reply);
                    

                    Quagga.decodeSingle({
                                src: 'data:image/jpg;base64,' + response.toString('base64'),
                                numOfWorkers: 0,  // Needs to be 0 when used within node
                                inputStream: {
                                },
                                decoder: {
                                    //readers: ["code_128_reader"] // List of active readers
                                    readers: ["ean_reader"] // List of active readers
                                },
                            }, function(result) {
                                if(result.codeResult) {
                                    console.log("result", result.codeResult.code);

                                    options.path = "getbarcode/"+result.codeResult.code.toString();
                                    //options.path = "getbarcode/"+session.userData.product.toString();
                                    http.get(options, function(res) {
                                      console.log("Got response: " + res.statusCode);

                                      res.on("data", function(chunk) {
                                        session.send('Ok... Here\'s the result: ' + chunk);
                                      });
                                    }).on('error', function(e) {
                                      console.log("Got error: " + e.message);
                                    });
                                } else {
                                    console.log("not detected");
                                }
                            });

                    

                }).catch(function (err) {
                    console.log('Error downloading attachment:');
                });
        }
    }
    else {
      session.send('Sorry, I did not understand \'%s\'.', session.message.text);
    }
});



intents.matches(/^info/i, [
    function (session) {
        session.beginDialog('/info');
    },
    function (session, results) {

        options.path = "getbarcode/"+session.userData.product.toString();
        http.get(options, function(res) {
          console.log("Got response: " + res.statusCode);

          res.on("data", function(chunk) {
            session.send('Ok... Here\'s the result: ' + chunk);
          });
        }).on('error', function(e) {
          console.log("Got error: " + e.message);
        });
       
    }
]);


bot.dialog('/info', [
    function (session) {
        builder.Prompts.text(session, 'What\'s the id of the product?');
    },
    function (session, results) {
        session.userData.product = results.response;
        session.endDialog();
    }
]);

bot.dialog('/', intents);    


if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function() {
        console.log('Test bot endpoint at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());    
} else {
    module.exports = { default: connector.listen() }
}


//UTILITIES

const hasImageAttachment = session => {
    return session.message.attachments.length > 0 &&
        session.message.attachments[0].contentType.indexOf('image') !== -1;
};

// Request file with Authentication Header
var requestWithToken = function (url) {
    return obtainToken().then(function (token) {
        return request({
            url: url,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/octet-stream'
            }
        });
    });
};

// Promise for obtaining JWT Token (requested once)
var obtainToken = Promise.promisify(connector.getAccessToken.bind(connector));

var checkRequiresToken = function (message) {
    return message.source === 'skype' || message.source === 'msteams';
};