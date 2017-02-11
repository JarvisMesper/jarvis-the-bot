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
.matches('Greetings', (session, args) => {
    session.send('Salut, j\'espère que tout roule pour toi ! Je suis expert en nutrition, demande-moi des trucs ;-)');
    session.beginDialog('/tuto');
})

.matches('PhotoTask', (session, args) => {
    session.send('Vous pouvez m\'envoyer une photo contenant le code-barre du produite, je vous donnerai des infos à son sujet.');
})
.matches('BarcodeTask', [
    function (session) {
        session.beginDialog('/info');
    },
    function (session, results) {

        options.path = "getbarcode/"+session.userData.product.toString();
        
        session.userData.secondlastproduct = session.userData.lastproduct;
        session.userData.lastproduct = session.userData.product.toString();

        http.get(options, function(res) {
          console.log("Got response: " + res.statusCode);

          var body = '';
          res.on('data', function (chunk) {
            body += chunk;
          });
          res.on('end', function () {
             var obj = JSON.parse(body);
            //var name = obj["name"];
            
            if(obj.data.length > 0) {
                session.send('Ok... Voici le résultat : ' + obj.data[0].name + "\n" + obj.data[0].images[0]);
            }
            else {
                session.send('Oh zut... Il semblerait que le produit ne soit pas référencé dans la base de donnée d\'openFood.ch');
            }
          });


        }).on('error', function(e) {
          console.log("Got error: " + e.message);
        });
    }
])
.matches('Compare', (session, args) => {
    if (args.entities.length == 2) {
        session.userData.secondlastproduct = args.entities[0].entity;
        session.userData.lastproduct = args.entities[1].entity;
    } else if (args.entities.length == 1) {
        session.userData.secondlastproduct = session.userData.lastproduct;
        session.userData.lastproduct = args.entities[0].entity;
    } 

    if (session.userData.lastproduct == undefined || session.userData.secondlastproduct == undefined) {
        session.send('Il faut que vous scanniez ou entriez 2 produits, ensuite je pourrais les comparer !');
    } else {
        session.send('Je compare volontiers les produits avec les code-barres ' + session.userData.secondlastproduct + ' et ' + session.userData.lastproduct + '. Voici un graphique comparatif :');
        session.sendTyping();

        options.path = 'comparaison/' + session.userData.secondlastproduct + '-' + session.userData.lastproduct;
        http.get(options, function(res) {

            console.log("Got response: " + res.statusCode);

            var body = '';
              res.on('data', function (chunk) {
                body += chunk.toString('base64');
                console.log("chunk: " + chunk);
              });
              res.on('end', function () {       
                var msg = new builder.Message(session)
                .addAttachment({
                    contentUrl:'data:image/jpg;base64,' + body,
                    contentType: 'image/png',
                    name: "comparaison.png"
                });

                session.send(msg);    
              });
        }).on('error', function(e) {
          console.log("Got error: " + e.message);
          session.send('Oh, il y a eu une erreur, il faudrait ré-essayer');
        });
    }
})
.matches('About', (session, args) => {
    session.sendTyping();
    session.send('Je suis Jarvis le nutritionniste. J\'ai été créé par Nathan, Jacky et Christian lors des Open Food Hackdays à l\'EPFL les 10 et 11 février 2017.');
    session.send('Plus d\'infos ici : https://github.com/JarvisMesper/jarvis-the-nutritionist');
})
.matches('Contains', [
    function (session, args) {

         if (args.entities.length == 1) {
            var nutrient = args.entities[0].entity;
            console.log("Trying to get contains" + nutrient);

            options.path = "product-contains/" + session.userData.lastproduct + "-" + nutrient;
            http.get(options, function(res) {

    //            console.log(res.toString('base64'))


                console.log("Got response: " + res.statusCode);

               

                var body = '';
                  res.on('data', function (chunk) {
                    body += chunk;
                  });
                  res.on('end', function () {
                    console.log("Got response: " + body + "\n \n \n");
                    if(body.data == true) {
                        session.send('Oui, ça contient du ' + nutrient);
                    }
                    else {

                        session.send('Non, ça ne contient pas de ' + nutrient);
                    }
                  });

                   
                

            }).on('error', function(e) {
              console.log("Got error: " + e.message);
            });
        } else {

        } 
     
        
       
    }
])

.onDefault((session) => {
    if (hasImageAttachment(session)) {
        session.send('J\'ai bien reçu l\'image, laisse-moi juste le temps de l\'analyser...');
        session.sendTyping();
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
                    Quagga.decodeSingle({
                                src: 'data:image/jpg;base64,' + response.toString('base64'),
                                numOfWorkers: 0,  // Needs to be 0 when used within node
                                inputStream: {
                                },
                                decoder: {
                                    //readers: ["code_128_reader"] // List of active readers
                                    readers: ["ean_reader","ean_8_reader"] // List of active readers
                                },
                            }, function(result) {
                                if(result.codeResult) {
                                    console.log("result", result.codeResult.code);
                                    console.log("last product was : ", session.userData.lastproduct);

                                    session.userData.secondlastproduct = session.userData.lastproduct;
                                    session.userData.lastproduct = result.codeResult.code.toString();

                                    options.path = "getbarcode/"+result.codeResult.code.toString();
                                    //options.path = "getbarcode/"+session.userData.product.toString();

                                    http.get(options, function(res) {
                                        console.log("Got response: " + res.statusCode);

                                        var body = '';
                                        res.on('data', function (chunk) {
                                            body += chunk;
                                        });
                                        res.on('end', function () {
                                             var obj = JSON.parse(body);
                                            //var name = obj["name"];
                                            if(obj.data.length > 0) {
                                                session.send('Ok... Il s\'agit de : ' + obj.data[0].name + "\n" + obj.data[0].images[0]);
                                            }
                                            else {
                                                session.send('Oh zut... Il semblerait que le produit ne soit pas référencé dans la base de données d\'OpenFood.ch');
                                            }
                                        });
                                    }).on('error', function(e) {
                                      console.log("Got error: " + e.message);
                                    });
                                } else {
                                    console.log("not detected");

                                    var reply = new builder.Message(session)
                                        .text("Je ne suis pas capable de voir le code barre sur cette photo, essaye avec un autre photo ou tappe le code manuellement.");

                                    session.send(reply);
                                 }
                            });

                }).catch(function (err) {
                    console.log('Error downloading attachment:');

                    var reply = new builder.Message(session)
                        .text("Je suis un peu fatigué, réessaye plus tard s'il te plaît.");

                    session.send(reply);
                });
        } else {

        }
    } else {
        session.send('Désolé je ne comprends pas vraiment ce que vous voulez de moi. Essayez autre chose ;-)');
    }
});




bot.dialog('/info', [
    function (session) {
        builder.Prompts.text(session, 'J\'ai besoin du numéro inscrit sur le code-barre s\'il te plaît');
    },
    function (session, results) {
        session.userData.product = results.response;
        session.endDialog();
    }
]);

bot.dialog('/image', [
    function (session) {
        builder.Prompts.text(session, 'Image?');
    },
    function (session, results) {
        session.userData.product = results.response;
        session.endDialog();
    }
]);

bot.dialog('/', intents);  


bot.dialog('/tuto', [
    function (session) {
        session.sendTyping();
        var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachments([
                new builder.HeroCard(session)
                    .title("Bienvenue")
                    .subtitle("Tutoriel")
                    .text("Je suis là pour vous aider, je suis nutritionniste après tout. Je suis intelligent, sympa et neutre, en plus je ne vous juge pas.")
                    .images([
                        builder.CardImage.create(session, "https://avatars3.githubusercontent.com/u/25685412?v=3&s=200")
                    ])
                    .buttons([
                        builder.CardAction.imBack(session, "photo", "Photo"),
                        builder.CardAction.imBack(session, "code-barre", "Code-barre"),
                    ])
            ]);
        session.endDialog(msg);
    }
]);  

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