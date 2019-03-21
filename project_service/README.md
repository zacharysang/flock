# Flock Project Service
This folder is home to flock's project service. The project service is a
component of flock that is 'always on', providing a reliable connection point
both for web-rtc protocol, and a node-0 hosting location. It is hidden from the
user utilizing flock. 

## Docker
Behind the scenes, the project service is utilized in a docke container.

[Link to docker hub registry entry for built docker container.](https://cloud.docker.com/repository/registry-1.docker.io/kurtlewis/flock-container).

### Building the Container
To build the container, run `docker build` from the command line:
```shell
$ docker build -t <image-name>:<tag> .
```

#### Running the Container
Running the container is relatively easy! It requires some environment
variables, [documented below](#Configuration Variables).
Run it with the following commands:
```shell
$ docker run -e <env variable list> <image-name>:<tag>
``` 

## Configuration Variables
The following variables are required 
 * `FLOCK_MIN_SIZE` : Specified by user, minimum number of nodes to wait for
before starting
 * `FLOCK_PORT` : Port for node app to listen on
 * `FLOCK_SESSION_SECRET` : Session secret used to generate session ids, should
be crypto-ey
 * `FLOCK_URL` : URL to reach flock at
