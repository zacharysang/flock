// define scale for tests
const CAP = 100;

// custom time function
function time(func, args=[], timerName='', trials=10) {
  
  let totalTime = 0;
  
  for (let i = 0; i < trials; i++) {
    let start = new Date()
    func(...args);
    let duration = (new Date()).valueOf() - start.valueOf();
    
    totalTime += duration;
  }
  
  let averageTime = totalTime / trials;
  console.log(`average time (${timerName}): ${averageTime}ms`);
  return averageTime;
}

// function that runs the timer on multilpe size inputs
function timeWithIncreasingInputs(func, argsList=[], trials=10) {
  let results = [];
  for (let i = 0; i < argsList.length; i++) {
    let result = time(func, argsList[i], i.toString(), trials);
    results.push(result);
  }
  
  return results;
}

// generate random list
function makeList(n=CAP) {
  let list = [];
  for (let i = 0; i < n; i++) {
    list.push(Math.random())
  }
  
  return list;
}
