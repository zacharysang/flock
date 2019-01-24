# Test Plan Overview

The goal of our test plan is to ensure that all parts of the Flock project function correctly. From a user’s perspective, Flock needs to provide convenience in creating and deploying a distributed computing project. From a volunteer’s perspective, Flock needs to provide the opportunity to utilize spare computing resources on a project. The entire Flock project is very user-oriented. Further, Flock will consist of a handful of loosely coupled parts, so different components will have vastly different testing and performance concerns. For example, because of the minimal interaction users will have with the Master server, we do not expect it to be a performance bottleneck. Therefore we do not need to vigorously test its performance. It is mainly based around user interaction, so its UX must be well thought out.. On the other hand, the sample project must demonstrate the value of distributed computing and of the Flock platform, so it will have strict performance requirements.

# Test Cases

#### SP1
2. Test performance improvements
3. Test a sequential run of the sample project and a parallelized run of the sample project and ensure a speedup has occurred
4. Number of nodes to use (2 vs 5)
5. Faster execution time for the project run with 5 nodes vs 2 nodes
6. Normal
7. Blackbox
8. Performance
9. Integration

#### SP2
2. Test integration of master service and workers
3. Create sample project to submit to master server, which will deploy the project service and utilize workers to complete the task
4. Sample project (link to GitHub with container and sample code)
5. Correct output of sample project
6. Normal
7. Blackbox
8. Functional
9. Integration

#### SP3
2. Test edge cases of number of nodes to run project with
3. Run sample project with 0, 1, and 10,000 nodes and ensure flock handles it gracefully
4. Number of nodes to use (0, 1, and 10,000)
5. Graceful error handling indicating too few (0, 1) or too many (10,000) nodes
6. Boundary
7. Blackbox
8. Functional
9. Unit

#### MS1
2. This test ensures that the master server can successfully deploy project servers to its container service.
3. Attempts to deploy sample project and tests that sample container is reachable.
4. Container to test deploy
5. Reachable container hosted in container service
6. Normal
7. Blackbox
8. Functional
9. Integration

#### MS2
2. Test distribution of worker nodes onto projects.
3. This test ensures that new workers are equally distributed to different ongoing projects equally.
4. Number of new workers and existing projects.
5. Equally distributed workers to each project.
6. Normal
7. Blackbox
8. Functional
9. Integration

#### MS3
2. Test login functionalities of master service
3. This test ensures that accounts can only be accessed with the correct password.
4. A username and incorrect password.
5. Failed login page/dialog.
6.  Normal
7. Blackbox
8. Functional.
9. Integration

#### WO1
2. Test the functionality of isend and irecv functions
3. To test the functionality of the mpi isend and irecv functions, unit tests will be developed to test these functions under high load with different input values
4. Parameters that will direct the functions to send arbitrary data between a number of destination nodes (~20-30 nodes) with and without the use of tags.
5. All nodes receive acknowledgement of the messages they send, and successfully receive all data targeted at them from other nodes
6. Normal
7. Blackbox
8. Functional
9. Unit

#### WO2
2. Test the functionality of barrier function
3. A unit test will be used to test that the barrier function is effective at synchronizing nodes and preventing race conditions. This will be done by sending communication across a communication group in stages separated by barriers, and making sure that the barrier is effective at separating these stages.
4. Parameters to repeatedly send stage-specific data between all nodes
5. All nodes receive data specific to the current stage before progressing to the next one
6. Normal
7. Blackbox
8. Functional
9. Unit

#### WO3
2. Test the functionality of communication groups
3. Unit tests will be developed to test that communication groups correctly separate groups of nodes. This will be done by splitting communication groups and broadcasting data and using barriers across these groups.
4. Data to be spread across distinct communication groups
5. All nodes receive portions of data specific to their communication group only
6. Normal
7. Blackbox
8. Functional
9. Unit

#### SL1
2. Test the functionality of the exposed standard library functions: scatter, reduce, broadcast, etc
3. The standard library functions that are exposed to the developer will be unit tested. Each function must be unit tested individually to ensure they perform as according to the openmpi documentation.
4. Appropriate data for each async MPI function
5. All functions perform the functionality as specified by openmpi
6. Normal
7. Blackbox
8. Functional
9. Unit

#### SL2
2. Test the performance of the standard library
3. Ensure that all methods provided in the Flock standard libraries are performant enough to be usable in a distributed computing project. This will be done by using the functions for a sample project.
4. Appropriate data for each standard library function
5. A speedup over a single-node application can be achieved in the sample project using standard library functions
6. Normal
7. Blackbox
8. Performance
9. Integration

#### SL3
2. Test the standard library using ESLint with require-jsdoc
3. Run ESLint against the standard library using the require-jsdoc flag to ensure the code is properly documented.
4. Standard library code
5. ESLint passes
6. Normal
7. Whitebox
8. Functional
9. Unit

# Test Matrix
| Identifier | Normal/Abnormal | Whitebox/Blackbox | Functional/Performance | Unit/Integration |
| ----------- | ----------------------- | ------------------------- | -------------------------------- | ------------------- |
| SP1 | Normal | Blackbox | Performance | Integration |
| SP2 | Normal | Blackbox | Functional | Integration |
| SP3 | Boundary | Blackbox | Functional | Unit |
| MS1 | Normal | Blackbox | Functional | Integration |
| MS2 | Normal | Blackbox | Functional | Integration |
| MS3 | Normal | Blackbox | Functional | Integration |
| WO1 | Normal | Blackbox | Functional | Unit |
| WO2 | Normal | Blackbox | Functional | Unit |
| WO3 | Normal | Blackbox | Functional | Unit |
| SL1 | Normal | Blackbox | Functional | Unit |
| SL2 | Normal | Blackbox | Performance | Integration |
| SL3 | Normal | Whitebox | Functional | Unit |
