# ABET Constraint Essay
Kurt Lewis, Laura Tebben, Zach Collins, Zachary Sang

There are a number of contraints that impact flock as a platform. One such constraint is economic.
The flock platform aims to decrease the economic cost of distributed computing platforms by utilizing
commodity hardware and free software. But, when implementing the solution, our group will need to rely
on already owned hardware and platforms, as purchasing hardware would exceed our budget limitations. 
Much of the software written for flock will rely on open source or free technologies, so software cost of the product
will be zero. Infrastructure to support flock will be hosted on low cost cloud providers, minimzing the cost
of maintaining centralized services. Shouldflock prove succesfull, it stands to benefit not only those
pursuing cost effective distributed computing resources, but also those donating their hardware to benefit 
distributed computing, should we find a methodto effectively reward worker nodes for the contributed resources. 


Because flock involves running uncontrolled code on uncontrolled hardware, there are a number of security risks,
both for resource volunteers and users. For a submitter of work to be done on flock, it is not secure to
trust secret information on worker nodes - data must be anonymized and worker nodes cannot be trusted with
access tokens for private data stores or services. To minimize this risk for the user, our platofrm will implement
a standard library, which will allow users to filter output data through server-side validation. For computing resource
volunteers, we will heavily rely upon browser sandboxing to protect volunteer machines from maliciously submitted code.
All submitted code will be javascript, meaning inspecting code for distributed jobs is trivial, and malicious jobs can be
rejected before even running. Users who continually submit malicious code can also be banned from participating in the service. 