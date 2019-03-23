"""
Kurt Lewis
This file handles the automagic deployment of projects onto AWS
"""
import hashlib
import os
import re

from flask import current_app

from flock_server.db import get_db

docker_compose_filename = 'docker_compose.yml'
ecs_params_filename = 'ecs_params.yml'

def generate_id(user_id, project_name):
    """Generates a unique hash id per project name + user_id.
    Concatenates user id to project name and hashes that using sha1.
    """
    string = str(user_id) + str(project_name)
    return hashlib.sha1(string.encode('utf-8')).hexdigest()

def get_config_file_paths(hash_id, deploy_folder_path):
    """Returns a tuple of config file paths (docker compose yml, ecs params yml)
    """
    folder_path = os.path.join(deploy_folder_path, hash_id)
    docker_compose_path = os.path.join(folder_path, docker_compose_filename)
    ecs_params_path = os.path.join(folder_path, ecs_params_filename)

    return (docker_compose_path, ecs_params_path)


def deploy_project(project_id):
    """Central driving function for deploying projects to AWS.
    """
    # Create the deploy folder path
    deploy_folder_path = os.path.join(current_app.instance_path, 'deploys')

    # get the project from that database
    db = get_db()
    cursor = db.cursor()
    project = cursor.execute(
        'SELECT * FROM projects where id=(?);',
        (project_id,)).fetchone()
    # generate hash
    hash_id = generate_id(project['owner_id'], project['name'])
    
    # first need to build config files
    build_config_files(hash_id, deploy_folder_path)

    start_container(hash_id, deploy_folder_path)

    # get url

    # update database entry
    
   

def build_config_files(hash_id, deploy_folder_path):
    """Builds the config files needed for deploying to AWS.
    """
    # define the docker compose file with params
    docker_compose = ('version \'3\'\n'
                      'services:\n'
                      '  {hash_id}:\n'
                      '    image: {image_name}\n'
                      '    environment:\n' # configure environment variables
                      '      - FLOCK_MIN_SIZE={flock_min_size}\n'
                      '      - FLOCK_PORT={flock_port}\n'
                      '      - FLOCK_SESSION_SECRET={flock_session_secret}\n'
                      '      - FLOCK_URL={flock_url}\n'
                      '    ports:\n'
                      '      - "{flock_port}:{flock_port}"\n'
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
    (docker_compose_path, ecs_params_path) = get_config_file_paths(hash_id, deploy_folder_path)

    # generate the docker compose file
    docker_compose = docker_compose.format(hash_id=hash_id,
                                           image_name=current_app.config['FLOCK_CONTAINER_NAME'],
                                           flock_min_size='temp',
                                           flock_port=current_app.config['FLOCK_PORT'],
                                           flock_session_secret='temp',
                                           flock_url='temp',
                                           group=current_app.config['FLOCK_LOG_GROUP'],
                                           region=current_app.config['FLOCK_REGION'],)
    with open(docker_compose_path, 'w') as file:
        file.write(docker_compose)
                                           
    # generate ecs params
    ecs_params = ecs_params.format(subnet_id_1=current_app.config['FLOCK_SUBNET_1_ID'],
                                   subnet_id_2=current_app.config['FLOCK_SUBNET_2_ID'],
                                   security_group_id=current_app.config['FLOCK_SECURITY_GROUP_ID'])
    with open(ecs_params_path, 'w') as file:
        file.write(ecs_params)
    

def start_container(hash_id, deploy_folder_path):
    (docker_compose_path, ecs_params_path) = get_config_file_paths(hash_id, deploy_folder_path) 

    # build the start command
    # TODO - i'm not sure if project name means something different
    # TODO - see if I can just use 'cluster' instead of cluster-config
    start_cmd = ('ecs-cli compose --project-name {hash_id} service up '
                 '--cluster-config {cluster_config} '
                 '--ecs-params {ecs_params} '
                 '--file {docker_compose} '
                 '--ecs-profile {ecs_profile} ')
    start_cmd = start_cmd.format(hash_id=hash_id,
                                 cluster_config=current_app.config['FLOCK_CLUSTER_CONFIG'],
                                 ecs_params=ecs_params_path,
                                 docker_compose=docker_compose_path,
                                 ecs_profile=current_app.config['FLOCK_ECS_PROFILE'])

    # Run the start command
    print(start_cmd)

def stop_container(hash_id):
    (docker_compose_path, ecs_params_path) = get_config_file_paths(hash_id)

    # build the stop command
    # TODO - i'm not sure if project name means something different
    # TODO - see if I can just use 'cluster' instead of cluster-config
    stop_cmd= ('ecs-cli compose --project-name {hash_id} service down '
                 '--cluster-config {cluster_config} '
                 '--ecs-params {ecs_params} '
                 '--file {docker_compose} '
                 '--ecs-profile {ecs_profile}')
    stop_cmd = stop_cmd.format(hash_id=hash_id,
                               cluster_config=current_app.config['FLOCK_CLUSTER_CONFIG'],
                               ecs_params=ecs_params_path,
                               docker_compose=docker_compose_path,
                               ecs_profile=current_app.config['FLOCK_ECS_PROFILE'])

def get_status(hash_id):
    # build the status command
    # TODO - I'm not sure if project-name means something different
    # TODO - see if I can just use 'cluster' instead of cluster-config
    status_cmd = ('ecs-cli compose --project-name {hash_id} service ps '
                 '--cluster-config {cluster_config} '
                 '--ecs-profile {ecs_profile}')
    status_cmd = status_cmd.format(hash_id=hash_id,
                                   cluster_config=current_app.config['FLOCK_CLUSTER_CONFIG'],
                                   ecs_profile=current_app.config['FLOCK_ECS_PROFILE'])

    # Run the status command and capture the output
    
    # find the IP address and health of the project using regex
