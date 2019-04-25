Hosting your project with Flock is almost as easy as volunteering!

# Things to Know
Flock hosts a persistent node-0 for all projects in a container in Amazon ECS,
along with the handshake server for webRTC. This means you'll always have a
node-0 online, and more than that, it's in a secure environment. Using a secrets
file, you can safely do database or output operations on the node-0 without
worrying about those secrets being exposed in the browser of your volunteers.


# Getting Started
1. If this is your first time hosting a project with Flock, you'll need to
create an account. If you already have an account, you can login.
+ If you haven't built your project, check out the developing tutorial for steps.

# Submitting your project
+ Visit the hosting page, and click to submit a new project to flock.
+ Enter the required details.
  + Project Name - What your project will appear as in the project listing.
  + Source URL - A reference to where your source code is hosted, for moderationpurposes.
  + Min Workers - The minimum number of workers your project needs (including node 0), to be able to work. With fewer than this number, workers will sit idle until the threshold is met.
  + Description - A description of your project. Use this to interest users in working on your project!
  + Code file : this is your actual code that runs for flock. It is loaded and excuted on all volunteers for your project. It is not possible to edit this file (because there's no way to tell your volunteer's its changed!), so it's a great idea to extensively test in development.
  + Secrets file: This file is only given to your node-0. This allows you to safely use secrets on your node-0, such as database keys, without worring about them being exposed to project volunteers.
+ Wait for the project to be approved through our moderator queue. Moderators ensure the platform isn't being abused, and can help find common issues in projects.
+ Your project is running!

# The Project Detail Page
You can find details on your project by clicking on its name from the project
listing page. The detail page will give you information on status, current
workers, and options for restarting and deleting the project.

# Editing a Flock Project
At time of writing, flock projects are immutable. It is not possible to update
source code or details on existing browser tabs, so it is necessary to delete
your project and create a new one if you have a change to make.

# Restarting Your Project Service
Project owners are able to restart their own project services if for instance,
their node-0 hangs, crashes, or there's another problem. Project owners can do
this by clicking the "Restart" button on their project detail page.

# Ending a Flock Project
To end your flock project, visit the project detail page and click on the
delete proejct button to stop it.

# FAQ
## I really can't edit my project?
No. Projects on flock are immutable because of volunteer orphaning. 
## How long do I have to wait for approval?
Our moderators are routinely checking and verifying submitted projects, and your
project will be accepted as soon as possible, provided there are no problems.
## Are my secrets safe?
Yes! Your secrets are stored only with flock. Your secrets are maintained on our
server and in a container environment that is inaccessible to end users.
## What is the minimum number of workers?
The minimum number of workers is the amount of workers (node-0 included), that
are needed for your project to operate. Your project will not start with fewer
than this number of projects.
