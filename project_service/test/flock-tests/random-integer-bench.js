/* global mpi */

// import flock-mpi
importScripts('/static/flock-mpi.js');

async function main() {
    
    // initialize volunteer's page
    mpi.updateStatus({
        projectTitle: 'Random Integer Benchmark',
        projectDescription: 'A CPU heavy benchmark used to demonstrate parallelization speedup using Flock. The application generates 10,000,000 random integers.',
        taskDescription: 'This node is generating a large amount of random integers and notifying Node 0 when it is done with its work.'
    });
    
    let rank = await mpi.getRank('default');
    console.log(`got rank: ${rank}`);
    
    let size = await mpi.getSize('default');
    console.log(`got size: ${size}`);
    
    if (rank === 0) {
        nums_per_rank = 1000000000 / (size - 1);
        let time = Date.now();
        await mpi.ibcast(nums_per_rank, 0, 'default');

        /*let nodes = [...Array(size).keys()].filter((val) => val !== 0);
        let reqs = [];
        nodes.forEach((rank) => {
            
            let req = mpi.irecv(rank, 'default');
            
            reqs.push(req);
        });
        console.log("Did this at least.");
        console.log(reqs);
        Promise.all(reqs).then(async () => {await mpi.isend(Date.now() - start, 1, 'default')});*/
        for (let i = 1; i < size; i++) {
            await mpi.irecv(i, 'default');
        }
        let stop = Date.now()
        await mpi.isend(stop - time, 1, 'default');

    } else {
        let count = await mpi.ibcast(0, 0, 'default');
        //console.log("Received Count: " + count);
        let time = Date.now();
        for (i = 0; i < count; i++) {
            let x = Math.random();
        }
        console.log(Date.now() - time);
        await mpi.isend(0, 0, 'default');
        //console.log("Finished.");
        let final_time = await mpi.irecv(0, 'default');
        console.log(final_time);
    }
}

main();
