# Jarvis the bot

Hey, I'm Jarvis the bot. Here you'll find how to install and use me. The bot is made to work with an API store in this repo : [https://github.com/JarvisMesper/jarvis-the-nutritionist](https://github.com/JarvisMesper/jarvis-the-nutritionist).


## Dependencies

You'll need to install [nodejs and npm](https://nodejs.org) in order to run the bot locally.


## Usage

First go to the `messages` directory.

	cd messages/

Run the `setup.py` install script then edit the `.env` file with the right credentials.

	node setup.py

To run the bot, install the deps with npm and launch it.

    npm install
    node index.js



### Emulator 

If you want to test the bot locally, you can use the [*BotFramework-Emulator*](https://dev.botframework.com).

Clone the repo : 

    git clone https://github.com/Microsoft/BotFramework-Emulator.git
    cd BotFramework-Emulator

Install Node packages :

    npm install

Build : 

    npm run build

Run :

    npm run start

NB : be sure that the var NODE_ENV var is `development`.

For more details : [go to the getting started page](https://github.com/Microsoft/BotFramework-Emulator/wiki/Getting-Started).