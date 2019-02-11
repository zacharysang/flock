// import flock-mpi
importScripts('/static/flock-mpi.js');

console.log('starting laps...');

async function main() {
    let rank = await mpi.getRank('default');
    let size = await mpi.getSize('default');
    
    let a = 0;
    while (true) {
        
        let next = (a + 1) % size;
    
        console.log(`rank: ${rank}, a: ${a}, next: ${next}, size: ${size}`);
        
        let start = Date.now();
        
        // send from a to a+1
        if (rank == a) {
            mpi.isend(a, next, 'default');
        } else if (rank == next) {
            mpi.irecv(a, 'default');
        }
        
        // send updated value to all nodes
        await mpi.ibcast(a, next, 'default').then((res) => {
            console.log(`${rank} - got result ${res} took ${Date.now() - start}ms`);
        });
        
        a = next;
        
        // sync nodes
        await mpi.ibarrier('default');
        
    }
}

main();