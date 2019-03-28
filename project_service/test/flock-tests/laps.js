/* global mpi */

// import flock-mpi
importScripts('/static/flock-mpi.js');

console.log('starting laps...');

async function main() {
    let rank = await mpi.getRank('default');
    
    console.log(`got rank: ${rank}`);
    
    let size = await mpi.getSize('default');
    
    console.log(`got size: ${size}`);
    
    let storedA = await mpi.storeGet('a');
    
    if (storedA) {
        console.log(`got stored A: ${storedA}`);
    } else {
        console.log(`no stored a value. Using 0...`);
    }
    
    let a = parseInt(storedA) || 0;
    console.log(`got a: ${a}`);
    while (true) {
        
        console.log('looping..');
        
        let next = (a + 1) % size;
    
        console.log(`rank: ${rank}, a: ${a}, next: ${next}, size: ${size}`);
        
        // send from a to a+1
        if (rank == a) {
            mpi.updateStatus({sending: next});
            console.log(`sent to next with status: ${await mpi.isend(a, next, 'default')}`);
            mpi.updateStatus({sending: 'sent'});
        } else if (rank == next) {
            mpi.updateStatus({receving: a});
            console.log(`received from a: ${await mpi.irecv(a, 'default')}`);
            mpi.updateStatus({receving: 'recevied'});
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