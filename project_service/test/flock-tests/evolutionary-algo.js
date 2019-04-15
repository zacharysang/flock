/* global mpi */

// import flock-mpi
importScripts('/static/flock-mpi.js');

/**
 * Measures the fitness of an individual. 0 = most fit.
 * Maximally fit individual is alternating string of 0101...
 * Worst possible fitness is length of the genome.
 * Stateless fitness eval. Pass in an individual, have its fitness returned.
 * 
 * @param {object} individual an individual consisting of a fitness and a genome
 * 
 * @returns {number} the fitness of the individual
 */
function fitnessEval(individual) {
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

/**
 * Get a random integer from range [min, max] inclusive.
 * 
 * @param {number} min minimum for returned integer
 * @param {number} max maximum for returned integer
 * 
 * @returns {number} a random integer
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Tournament-style selection of one individual from a population.
 * Selects tournSize individuals, and returns the best among them.
 * Assumes fitnesses are already evaluated.
 * 
 * @param {array} population a population of individuals to select from
 * @param {number} tournSize number of individuals in the tournament
 * 
 * @returns {object} the best individual selected in the tournament
 */
function tournamentSelect(population, tournSize) {
    let max = population.length - 1;
    let participants = [];
    for (let i = 0; i < tournSize; i++) {
        participants.push(population[getRandomInt(0, max)]);
    }
    return bestIndInPopulation(participants);
}

/**
 * Gets the index of the best individual in a population.
 * Assumes fitnesses are already evaluated.
 * 
 * @param {array} population The population to search in
 * 
 * @returns {number} the index of the best individual in the population array
 */
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

/**
 * Gets the best individual in a population.
 * Assumes fitnesses are already evaluated.
 * 
 * @param {array} population The population to search in
 * 
 * @returns {object} The best individual object in the population array
 */
function bestIndInPopulation(population) {
    return population[idxOfBestIndInPopulation(population)];
}

/**
 * Gets the best fitness in the population.
 * Assumes fitnesses are already evaluated.
 * 
 * @param {array} population The population to search in
 * 
 * @returns {number} The maximum fitness in the population
 */
function bestFitnessInPopulation(population) {
    return population[idxOfBestIndInPopulation(population)].fitness;
}

/**
 * Random mutation function. Sateless - returns a copy of the individual with mutations applied.
 * Does not modify individual passed in.
 * Selects 0 to 10 bits in the genome to mutate, randomly assigns 0 or 1 to each of those bits.
 * You must manually reevaluate fitness after mutating.
 * 
 * @param {object} individual The individual to mutate
 * 
 * @returns {object} A new individual - mutated version of the entered individual.
 */
function mutate(individual) {
    let m_genome = individual.genome.slice()
    let num_mutations = getRandomInt(0, 10);
    for (let i = 0; i < num_mutations; i++) {
        let mut_idx = getRandomInt(0, m_genome.length);
        m_genome[mut_idx] = getRandomInt(0, 1);
    }
    return {fitness: Number.MAX_SAFE_INTEGER, genome: m_genome};
}

/**
 * Produces a shallow copy of an individual.
 * 
 * @param {object} individual the individual to copy
 * 
 * @returns {object} A shallow copy of the individual
 */
function clone(individual) {
    n_fitness = individual.fitness;
    n_genome = individual.genome.slice()
    new_ind = {fitness: n_fitness, genome: n_genome};
    return new_ind;
}

/**
 * Stateful fitness measurement of a population.
 * Modifies the fitness of each individual in the population passed in.
 * 
 * @param {array} population The population whose fitness should be measured
 */
function measureFitness(population) {
    for (let i = 0; i < population.length; i++) {
        population[i].fitness = fitnessEval(population[i]);
    }
}

/**
 * A distributed way to measure fitness. Scatters individuals among all nodes.
 * Very effective if fitness evaluation takes a long time.
 * Does not modify the original population - the returned item is a shallow copy.
 * 
 * @param {array} population The population whose fitness should be measured
 * 
 * @returns {array} The population with fitnesses evaluated
 */
async function distributedMeasureFitness(population) {
    let res = await mpi.iscatter(population, 0, 'default');
    if (res === undefined) {
        res = [];
    } else {
        measureFitness(res);
    }
    await sleep(1000);

    return await mpi.igather(res, 0, 'default');
}

/**
 * Sleep utility function. Await this function to actually pause.
 * 
 * @param {number} ms number of milliseconds to sleep
 * 
 * @returns {promise} a promise that sleeps ms seconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms, 'sleep'));
}

/**
 * Measure the best, worst, and average fitness in a population.
 * Assumes fitnesses are already evaluated.
 * 
 * @param {array} population The population whose statistics should be measured
 * 
 * @returns {array} [best, worst, average]
 */
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

/**
 * Calculate the progress as a percentage, based on current best fitness and worst possible fitness.
 * 
 * @param {number} fitness The fitness whose progress to measure
 * @param {number} genomeLength The length of the genome the fitness is measuring
 * 
 * @returns {number} The progress of the evolutionary algorithm
 */
function calculateProgress(fitness, genomeLength) {
    return Math.floor(100 * (genomeLength - fitness) / genomeLength);
}

async function broadcastDisplay(population, gen, genomeLength) {
    console.log("Statistics after generation " + gen + "...");
    statistics = stats(population);
    console.log("Best:    " + statistics[0]);
    console.log("Worst:   " + statistics[1]);
    console.log("Average: " + statistics[2]);
    progress = calculateProgress(statistics[0], genomeLength);
    best_ind = bestIndInPopulation(population);
    await mpi.ibcast({statistics: statistics, gen: gen, progress: progress, best: best_ind}, 0, 'default');
}

async function main() {
    
    // initialize volunteer's page
    mpi.updateStatus({
        projectTitle: 'Bitstream Evolution',
        projectDescription: 'An evolutionary algorithm to evolve a BitStream to meet a certain target.',
        taskDescription: 'This node is performing fitness evaluations.'
    });
    
    let rank = await mpi.getRank('default');
    console.log(`got rank: ${rank}`);
    
    let size = await mpi.getSize('default');
    console.log(`got size: ${size}`);
    
    if (rank === 0) {

        while (true) {
            let population = [];
            let popSize = 1000;
            let genomeLength = 128;
            let n_gen = 0;
            
            let MUTPB = 0.8;

            for (let i = 0; i < popSize; i++) {
                let genome = Array.from({length: genomeLength}, () => getRandomInt(0, 1));
                population.push({
                    fitness: Number.MAX_SAFE_INTEGER,
                    genome: genome
                });
            }
            
            population = await distributedMeasureFitness(population);
            await broadcastDisplay(population, n_gen, genomeLength);

            while (bestFitnessInPopulation(population) > 0) {
                let next_population = [];

                while (next_population.length < popSize) {
                    let new_ind = clone(tournamentSelect(population, 6));
                    if (Math.random() < MUTPB) {
                        new_ind = mutate(new_ind);
                    }
                    next_population.push(new_ind);
                }

                next_population = await Promise.race([distributedMeasureFitness(next_population), sleep(60000)])
                    .then(function(value) {
                        return value;
                    });
                
                if (next_population === 'sleep') {
                    await broadcastDisplay(population, 'paused', genomeLength);
                } else {
                    population = next_population;
                    await broadcastDisplay(population, n_gen, genomeLength);
                    n_gen++;
                }
            }

            console.log("Finished!");
            console.log("Number of generations: " + n_gen);
            console.log("Best individual: " + bestIndInPopulation(population));
        }

    } else {

        while (true) {
            await Promise.race([distributedMeasureFitness([]), sleep(60000)])
                .then(function(value) {
                    return value;
                });
            console.log("Measured fitness.");
            let disp = await mpi.ibcast(0, 0, 'default');
            console.log("Got broadcast.");
            mpi.updateStatus({
                "Fitness Statistics\n(smaller is better)": "Generations: " + disp.gen + "\nBest: " + disp.statistics[0] +
                    "\nWorst: " + disp.statistics[1] + "\nAverage: " + disp.statistics[2],
                progress: {reset: true, increment: disp.progress},
                "Best Individual:": disp.best.genome.join("")
            });
        }

    }
}

main();
