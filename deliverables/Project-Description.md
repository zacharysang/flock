# flock - enabling the creations and operation of general-purpose clusters over the web

## Team Members:
|Name | Email|
|-----|------|
|Zachary Sang|sangzf@mail.uc.edu|
|Kurt Lewis|lewis2ku@mail.uc.edu|
|Zachary Collins|collinzy@mail.uc.edu|
|Laura Tebben|tebbenla@mail.uc.edu|

## Faculty Advisor - TBD

## Problem Statement
Many of today's computing demands require some form of distribution.
To complete large data processing tasks such as classification, image processing, and model training, the work must be distributed and divded in order to get usable results in a timely manner.
While this need remains to be satisfied, there is also a supply of capable but older hardware that is available to perform this work.
This hardware has potential to complete useful comutational tasks, but is instead discarded or otherwise unused.

## Project Background Description
This project solves the above problem by building an avenue for under-utilized hardware to fulfill various computational needs by becoming a member of a cluster.
A portal will exist to allow work to be submitted to a master node, which will be scheduled and dispatched to worker nodes in the cluster.
Any device with a browser of sufficient version will be able to subscribe as a worker to the cluster, after which it will being to receive work requests from the master.
Overall, this will increase utilization of computing power, while fulfilling computational needs.

## Inadequacy Of Current Solutions
There currently exists a number of distributed computing frameworks, and even a small number available which are implemented for in browser use. 
By utilizing browsers and removing installation requirements for distributed computing, the number of devices that can run workloads is increased significantly. 
Using browsers allows for reuse of already implemented security functionality such as sandboxing. Existing browser based distributed computing frameworks are out of date - new browser technologies such as service workers will allow for new more powerful and secure approaches to distributed computing via the browser.

## Team Approach to Problem
We're approaching distributed computing from a perspective of openness. 
Distributed computing has the potential to revolutionize parallel computing, but most distributed computing projects target high performance platforms. 
Inspired by the success of the Folding@home project, our goal is to create a platform where anybody can submit a parallel problem and provide an algorithm for a very large number of nodes to run. In the end, we will demonstrate a series of workers running a massively parallel problem.

## Background skills/interests
All members of our team have worked with JavaScript before and created web applications as a team. 3 of us are currently taking the course Parallel Computing.
