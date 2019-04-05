# Setting up the dev environment
To contribute to flock, you're going to need to be able to run the project locally. You can do this with the following steps:
* Clone flock from github at: `https://github.com/zacharysang/flock.git`
* Follow the instructions for setting up a development environment in the specific component you're interested in working with

# Setting up for project_service
Within the flock codebase, the `flock/project_service` directory contains an npm project that contains the code used to run each individual flock project.

This project runs an express server which includes the following:
* easyrtc server : Used for P2P communication between browsers
* socketio serer : Used by easyrtc server as a fallback when WebRTC isn't available in a node's browsers
* puppeteer instance : A chrome browser instance which hosts the project cluster's rank 0 node

To set up the development environment in this directory, do the following:
* Change the directory to `flock/project_service`
* Ensure that NodeJS version 10 is installed (`node --version`)
* Run `npm install` (to get install the dependencies used by this project)
* Ngrok may fail to install during the above step due to [this issue](https://github.com/bubenshchykov/ngrok/issues/115#issuecomment-380927124). If this happens run `npm install --unsafe-perm ngrok`.
* Install headless chrome by running the following commands (assumes you're running linux. If you aren't refer to the inline comments for an idea of what you'll need to setup):

```
# Installs dependency missing for chrome-unstable (See: https://crbug.com/795759)
apt install libgconf-2-4

# Install the chrome apt repo so we can download chrome-unstable from them
apt update && apt install -y wget --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
    
# Update packages source and then install chrome-unstable (headless chrome is used for testing chrome and so it coupled to chrome-unstable)
apt-get update \
    && apt-get install -y google-chrome-unstable --no-install-recommends
    
```

* Set up environment variables by creating a `.env` file in `flock/project_service` with the following variables:

```
FLOCK_DEV=true # Whether or not flock is running in a development environment
FLOCK_PORT # Port for node app to listen on
FLOCK_SESSION_SECRET # Used to generate session ids, should be crypto-ey
FLOCK_URL # (only used in production) Url to reach the flock project page
FLOCK_MIN_SIZE # Minimum number of nodes to wait for before starting
LOCALTUNNEL_URL # (required only in production) Url for a localtunnel server. If ommitted in dev environment, will default to localtunnel.me
DEPLOY_SUBDOMAIN # Subdomain to be requested from the localtunnel server
```

Once you have the environment setup, you will be able to run the project using the command `npm run dev`. This will get a public url from [ngrok](https://ngrok.com/) that will be printed in the console.
The project running will host the page `flock/project_service/test/flock-tests/index.html`, which specifies the application that is running.
Referring to the `package.json` file in this directory will show you some other commands you can run during development. These include `npm run test` (to runs unit tests), and `npm run docs` (to generate updated jsdocs)
