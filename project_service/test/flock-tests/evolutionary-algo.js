/* global mpi */

// import flock-mpi
importScripts('/static/flock-mpi.js');

function fitness_eval(individual) {
    let fitness = 0;
    for (let i = 0; i < individual.genome.length; i++) {
        if (i % 2 === 0 && individual.genome[i] === 1) {
            fitness++;
        }
        if (i % 2 === 1 && individual.genome[i] === 0) {
            fitness++;
        }
    }
    return fitness;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function tournamentSelect(population, tournSize) {
    let max = population.length - 1;
    let participants = [];
    for (let i = 0; i < tournSize; i++) {
        participants.push(population[getRandomInt(0, max)]);
    }
    return idxOfBestIndInPopulation(participants);
}

function idxOfBestIndInPopulation(population) {
    let best_idx = 0;
    let best_fit = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < population.length; i++) {
        if (population[i].fitness < best_fit) {
            best_idx = i;
            best_fit = population[i].fitness;
        }
    }
    return best_idx;
}

function bestIndInPopulation(population) {
    return population[idxOfBestIndInPopulation(population)];
}

function bestFitnessInPopulation(population) {
    return population[idxOfBestIndInPopulation(population)].fitness;
}

function mutate(individual) {
    let genome = individual.genome.slice()
    let num_mutations = getRandomInt(0, 10);
    for (let i = 0;  i < num_mutations; i++) {
        let mut_idx = getRandomInt(0, genome.length);
        genome[mut_idx] = getRandomInt(0, 1);
    }
}

function clone(individual) {
    fitness = individual.fitness;
    genome = individual.genome.slice()
    return {fitness: fitness, genome: genome};
}

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

    } else {
        let population = [];
        let popSize = 1000;
        let genomeLength = 128;
        for (let i = 0; i < popSize; i++) {
            let gen = Array.from({length: genomeLength}, () => getRandomInt(0, 1));
            population.push({
                fitness: Number.MAX_SAFE_INTEGER,
                genome: gen
            });
        }
        
    }
}

main();
