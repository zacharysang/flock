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
    return bestIndInPopulation(participants);
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
    let m_genome = individual.genome.slice()
    let num_mutations = getRandomInt(0, 10);
    for (let i = 0; i < num_mutations; i++) {
        let mut_idx = getRandomInt(0, m_genome.length);
        m_genome[mut_idx] = getRandomInt(0, 1);
    }
    return {fitness: Number.MAX_SAFE_INTEGER, genome: m_genome};
}

function clone(individual) {
    n_fitness = individual.fitness;
    n_genome = individual.genome.slice()
    new_ind = {fitness: n_fitness, genome: n_genome};
    return new_ind;
}

function measure_fitnesses(population) {
    for (let i = 0; i < population.length; i++) {
        population[i].fitness = fitness_eval(population[i]);
    }
}

function stats(population) {
    let best = Number.MAX_SAFE_INTEGER;
    let worst = 0;
    let avg = 0;
    population.forEach((individual) => {
        if (individual.fitness < best) {
            best = individual.fitness;
        }
        if (individual.fitness > worst) {
            worst = individual.fitness;
        }
        avg += individual.fitness;
    });
    avg = avg / population.length;
    return [best, worst, avg];
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

        await mpi.irecv(1, 'default');

    } else {
        let population = [];
        let popSize = 100;
        let genomeLength = 16;
        
        let MUTPB = 0.8;

        for (let i = 0; i < popSize; i++) {
            let gen = Array.from({length: genomeLength}, () => getRandomInt(0, 1));
            population.push({
                fitness: Number.MAX_SAFE_INTEGER,
                genome: gen
            });
        }
        
        measure_fitnesses(population);
        console.log("Initial population statistics...");
        let statistics = stats(population);
        console.log("Best:    " + statistics[0]);
        console.log("Worst:   " + statistics[1]);
        console.log("Average: " + statistics[2]);
        let n_gen = 0;
        while (bestFitnessInPopulation(population) > 0) {
            let next_population = [];

            while (next_population.length < popSize) {
                let new_ind = clone(tournamentSelect(population, 6));
                if (Math.random() < MUTPB) {
                    new_ind = mutate(new_ind);
                }
                next_population.push(new_ind);
            }

            population = next_population;
            measure_fitnesses(population);
            n_gen++;
            console.log("Statistics after generation " + n_gen + "...");
            statistics = stats(population);
            console.log("Best:    " + statistics[0]);
            console.log("Worst:   " + statistics[1]);
            console.log("Average: " + statistics[2]);
        }

        console.log("Finished!");
        console.log("Best individual: " + bestIndInPopulation(population));
    }
}

main();
