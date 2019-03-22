This directory is home to the master service of flock.

Setup and usage instructions are forthcoming...

# Setup
## Python
The actual webserver is written in python. For everything but project
deployment, it can be sufficient to only do this portion.
First setup a virtual environment using `python3` (which might just be `python`
on your system). Then install the necessary requirements

```
$ pwd
 ..../..../flock/master
$ python3 -m venv venv
$ source venv/bin/activate
# pip install -r requirements.txt
```
See the below section on running in a development environment for creating
a database.

## AWS Setup
Because this project interfaces with AWS cli's, it's necessary to install a
few AWS tools. First install the [AWS CLI]()
and the [ECS CLI](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ECS_CLI_installation.html).

This project requires a dedicated IAM user for a secret key and ID.
That user needs to have the Policy `AmazonECSTaskExecutionRolePolicy`.
If I can reduce the needed permissions, I'll document that here.

You'll also need a second AWS IAM user with more thorough permissions for the
initial configuration steps. I use my full power personal account to do this.
These steps will be runnable from any machine, so it is possible to run them
from a development machine and avoid having these credentials ever touch the
production environment. Initial configuration steps also require the
[AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html).

### Configuring Fargate Cluster
Containers deployed from the flock_server application will be deployed to
a fargate cluster you define by following these steps. These steps need run
with a higher-privilege account than what should be used for the automatic
deployments. These steps don't need to be run from the deployment server.

1. Configure a user for your management. This is the high privilege user.
```
$ export AWS_ACCESS_KEY_ID=<your key id>
$ export AWS_SECRET_ACCESS_KEY=<your key>
$ ecs-cli configure profile --profile-name <profile_name> --access-key $AWS_ACCESS_KEY_ID --secrete-key $AWS_SECRET_ACCESS_KEY
```
2. Setup a cluster config
```
$ ecs-cli configure --region us-east-1 --cluster flock-cluster --default-launch-type FARGATE --config-name flock-cluster-config
```
3. Bring the cluster up
```
$ ecs-cli up --ecs-profile <profile_name> --cluster ecs-flock
``` 
This outputs three important pieces of information that need recorded for later.
* VPC ID
* Subnet1 ID
* Subnet2 ID
4. Using the VPC ID, create a security group
```
$ aws ec2 create-security-group --group-name "flock-sg" --description "Flock Security Group" --vpc-id <VPC ID>
```
This will output a security group ID, save it.

5. Authorize the security group. TODO: this will probably be different in
actuality, because we use at least UDP on probably a different port.
```
$ aws ec2 authorize-security-group-ingress --group-id <Security Group ID> --protocol tcp --port 80 --cidr 0.0.0.0/0
```
The cluster should now be operational.

#### Shutting down
If needed, shut down the cluster using the following command.
```
$ ecs-cli down --force --cluster-config ecs-flock
``` 
Occasionally the cluster shutdown process is slow or fails. If this is the case,
it could be a resource deadlock. I've resolved it using the UI and typically
deleting the VPC or security group stopping the delete. The cloud formation
console has useful information to figure out the problem.

### Setting up ecs-cli on the deployment server
The deployment server should have a different user that has restricted
permissions. We'll need to replicate some configuration settings on the server.
These commands should be run as the user that will run the server.

1. Install the ecs-cli
2. Configure a profile for the reduced permissions account.
```
$ export AWS_ACCESS_KEY_ID=<your key id>
$ export AWS_SECRET_ACCESS_KEY=<your key>
$ ecs-cli configure profile --profile-name flock-user --access-key $AWS_ACCESS_KEY_ID --secrete-key $AWS_SECRET_ACCESS_KEY
```
3. Duplicate the cluster config command ran when the cluster was created.
```
$ ecs-cli configure --region us-east-1 --cluster flock-cluster --default-launch-type FARGATE --config-name flock-cluster-config
```


# Running
## Development
To run in a development environment, use the following commands. The environment
variables only need set once per shell session.
```
$ export FLASK_APP=flock_server
$ export FLASK_ENV=development
$ flask run
```
If it's your first time running the site, or you want to rest all data in the
database, run the following command with `FLASK_APP` and `FLASK_ENV` defined.
```
$ flask init-db
```
After the project has been run once, you can setup configuration variables.
Using the generated `instance/` folder, which is likely in the folder next to
`flock_server/`, copy `config.py.example` as `config.py`. Fill in values using
the generated AWS values.

# Generate a module for distribution
To register the module locally, run:
```
$ pip install -e .
```

# Testing
To run tests, with the environment variables from above set, the virtual env
activated, and the package registered locally run:
```
$ pytest
```
To run a coverage report, run:
```
$ coverage run -m pytest
```
To generate the coverage report, run:
```
$ coverage html
```

# Working on this app
This app is written in Flask.
 [Their documentation can be found here](http://flask.pocoo.org/docs/1.0/).

[Working with templates.](http://flask.pocoo.org/docs/1.0/patterns/templateinheritance/#template-inheritance)

