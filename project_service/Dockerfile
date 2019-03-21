# Base image - ubuntu
FROM ubuntu:18.04

# Install packages
RUN apt-get update
# Upgrade packages
RUN apt-get upgrade -y
# remove packages we don't need
RUN apt-get autoremove -y

# install nodejs
RUN apt-get install nodejs -y
RUN apt-get install npm -y

# copy our rtc server into the project
RUN mkdir /opt/rtc-server/
COPY app.js /opt/rtc-server/
COPY package.json /opt/rtc-server/
COPY package-lock.json /opt/rtc-server/

# install dependencies for node server
WORKDIR /opt/rtc-server/
RUN npm install --production | tee /var/log/rtc-server-npm-install.log


# TODO: figure out environment variables for node server
