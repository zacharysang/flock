# Base image - ubuntu
FROM ubuntu:18.04

# Install packages
RUN apt-get update
# Upgrade packages
RUN apt-get upgrade -y
# remove packages we don't need
RUN apt-get autoremove -y

# install nodejs
# https://github.com/nodesource/distributions/blob/master/README.md#deb
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get install -y nodejs
#RUN apt-get install -y npm

# Configure headless chrome
RUN apt-get install -yq libgconf-2-4
RUN apt update && apt install -y wget --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub |\
      apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-unstable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
#    && apt-get purge --auto-remove -y curl \
    && rm -rf /src/*.deb

# copy our rtc server into the project
RUN mkdir /opt/rtc-server/
COPY app.js /opt/rtc-server/
COPY package.json /opt/rtc-server/
COPY package-lock.json /opt/rtc-server/

# install dependencies for node server
WORKDIR /opt/rtc-server/
RUN npm install --production | tee /var/log/rtc-server-npm-install.log

ENV NODE_ENV=production
CMD ["npm", "start"]
