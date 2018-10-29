# ABET Constraint Essay
Kurt Lewis, Laura Tebben, Zach Collins, Zachary Sang

There are a number of contraints that impact flock as a platform. One such constraint is economic.
The flock platform aims to decrease the economic cost of distributed computing by utilizing
commodity hardware and free software. But, when implementing the solution, our group will need to rely
on already owned hardware and platforms, as purchasing hardware would exceed our budget limitations. 
Much of the software written for flock will rely on open source or free technologies, so software cost of the product
will be zero. Infrastructure to support flock will be hosted on low cost cloud providers, minimzing the cost
of maintaining centralized services. Additionally, if flock becomes successful, it would benefit those
pursuing cost effective distributed computing resources and those donating their hardware to find a method for effectively rewarding worker nodes for contributed resources. 

Because flock involves running uncontrolled code on uncontrolled hardware, there are a number of security risks,
both for resource volunteers and users. It is not secure for a submitter of work to
trust secret information on worker nodes - data must be anonymized and worker nodes cannot be trusted with
access tokens for private data stores or services. To minimize this risk for the user, our platofrm will implement
a standard library, which will allow users to filter output data through server-side validation. For computing resource
volunteers, we will heavily rely upon browser sandboxing to protect volunteer machines from maliciously submitted code.
All submitted code will be javascript, meaning inspecting code for distributed jobs is trivial, and malicious jobs can be
rejected before even running. Users who continually submit malicious code can also be banned from participating in the service.
