"""
Kurt Lewis
This file handles the automagic deployment of projects onto AWS
"""
import hashlib
import os

from flask import current_app

from flock_server.db import get_db

deploy_folder_path = os.path.join(current_app.instance_path, 'deploys')
docker_compose_filename = 'docker_compose.yml'
ecs_params_filename = 'ecs_params.yml'

def generate_id(user_id, project_name):
    """Generates a unique hash id per project name + user_id.
    Concatenates user id to project name and hashes that using sha1.
    """
    string = str(user_id) + str(project_name)
    return hashlib.sha1(string.encode('utf-8')).hexdigest()

def get_config_file_paths(hash_id):
    """Returns a tuple of config file paths (docker compose yml, ecs params yml)
    """
    folder_path = os.path.join(deploy_folder_path, hash_id)
    docker_compose_path = os.path.join(folder_path, docker_compose_filename)
    ecs_params_path = os.path.join(folder_path, ecs_params_filename)

    return (docker_compose_path, ecs_params_path)


def deploy_project(project_id):
    """Central driving function for deploying projects to AWS.
    """
    # get the project from that database
    db = get_db()
    project = cursor.execute(
        'SELECT * FROM projects where id=(?);',
        (id,)).fetchone()
    # generate hash
    hash_id = generate_id(project['owner_id'], project['name'])
    
    # first need to build config files
    build_config_files(hash_id)

    deployment_url = start_container(hash_id, docker_compose_path,
                                     ecs_params_path)
    
   

def build_config_files(hash_id):
    """Builds the config files needed for deploying to AWS.
    """
    # define the docker compose file with params
    docker_compose = ('version \'3\'\n'
                      'services:\n'
                      '  {hash_id}:\n'
                      '    image: {image_name}\n'
                      '    ports:\n'
                      '      - "80:80"\n'
                      '    logging:\n'
                      '      driver: awslogs\n'
                      '      options:\n'
                      '        awslogs-group: {group}\n' # Should be hardcoded?
                      '        awslogs-region: {region}\n'
                      '        awslogs-stream-prefix: {hash_id}\n')
    # define the ecs params file with params
    ecs_params = ('version: 1\n'
                  'task_definition:\n'
                  '  task_execution_role: ecsTaskExecutionRole\n'
                  '  ecs_network_mode: awsvpc\n'
                  '  task_size:\n'
                  '    mem_limit = 0.5GB\n'
                  '    cpu_limit = 256\n'
                  'run_params:\n'
                  '  network_configuration:\n'
                  '    awsvpc_configuration:\n'
                  '      subnets:\n'
                  '        - "{subnet_id_1}"\n'
                  '        - "{subnet_id_2}"\n'
                  '      security_groups:\n'
                  '        - "{security_group_id}"\n'
                  '      assign_public_ip: ENABLED\n')
    # check to see if a folder for this project has been created in the instance
    # folder
    path = os.path.join(deploy_folder_path, hash_id)
    if not os.path.exists(path):
        # it doesn't exist, so make the path
        os.makedirs(path)
    elif not os.path.isdir(path):
        print('Error: {path} cannot be made because it is a file.'
              .format(path=path))
        raise Exception
    
    #
    # generate the files and write them to the directory
    #
    # get the paths for the files
    (docker_compose_path, ecs_params_path) = get_config_file_paths(hash_id)

    # generate the docker compose file
    docker_compose = docker_compose.format(hash_id=hash_id,
                                           image_name='temp',
                                           group='flock',
                                           region='aws-east',)
    with open(docker_compose_path, 'w') as file:
        file.write(docker_compose)
                                           
    # generate ecs params
    ecs_params = ecs_params.format(subnet_id_1=current_app.config['FLOCK_SUBNET_1_ID'],
                                   subnet_id_2=current_app.config['FLOCK_SUBNET_2_ID'],
                                   security_group_id=current_app.config['FLOCK_SECURITY_GROUP_ID'])
    with open(ecs_params_path, 'w') as file:
        file.write(ecs_params)
    

def start_container(hash_id):
    # build the start command
    start_command = ('')
    (docker_compose_path, ecs_params_path) = get_config_file_paths(hash_id) 
