/* global mpi */

// import flock-mpi
importScripts('/static/flock-mpi.js');

console.log('starting laps...');

async function main() {
    
    // initialize volunteer's page
    mpi.updateStatus({
        projectTitle: 'Laps',
        projectDescription: 'An io-heavy application to test sending and receiving p2p messages using easyrtc and flock',
        taskDescription: 'This node is participating in a loop of nodes sending and receiving messages from each other. Each message updates the value of "a"'
    });
    
    let rank = await mpi.getRank('default');
    
    console.log(`got rank: ${rank}`);
    
    let size = await mpi.getSize('default');
    
    console.log(`got size: ${size}`);
    
    let a = parseInt(await mpi.storeGet('a')) || 0;
    console.log(`got a: ${a}`);
    while (true) {
        
        mpi.updateStatus({progress: 5});
        
        console.log('looping..');
        
        let next = (a + 1) % size;
    
        console.log(`rank: ${rank}, a: ${a}, next: ${next}, size: ${size}`);
        
        // send from a to a+1
        if (rank == a) {
            mpi.isend(a, next, 'default');
            
            console.log(`sent to next: ${next}`);
            
        } else if (rank == next) {
            mpi.irecv(a, 'default');
            
            console.log(`received from a: ${a}`);
        }
        
        a = next;
        mpi.storeSet('a', a);
        
        mpi.updateStatus({a, size});
        
        console.log(`going into barrier with new 'a' value: ${a}`);

        
        // sync nodes
        await mpi.ibarrier('default');
        
        console.log(`got out of barrier with new 'a' value: ${a}`);
    }
}

main();