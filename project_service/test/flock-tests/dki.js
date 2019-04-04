importScripts('/static/flock-mpi.js');

console.log('init dki.js');

class Scrape {
    constructor(url) {
        this.url = url;
        //this.collection = collection;
        this.num_discovered_links = 0;

        // readFileSync('stop-words.txt', { encoding: 'utf-8' }, function (err, data) {
        //     if (!err) {
        //         this.stopWords = new Set();
        //         for (var idx = 0; idx < keywords.length; idx++) {
        //             this.stopWords.add(keywords[idx]);
        //         }
        //     } else {
        //         console.log('failed to open stop-words.txt')
        //     }
        // });
    }

    setUrl(url) {
        this.url = url;
    }

    findLinks(html) {
        //console.log(html);
        let all_links = [];
        let ret_links = [];

        let re = /<a href\s*=\s*"(((?!\s).)*)"/g;
        do {
            var m = re.exec(html);
            if (m) {
                all_links.push(m[1]);
            }
        } while (m);

        // let doc = document.createElement("html");
        // doc.innerHTML = html;
        // let links = doc.getElementsByTagName("a")

        // for (let i=0; i<links.length; i++) {
        //     all_links.push(links[i].getAttribute("href"));
        // }

        for (let idx = 0; idx < all_links.length; idx++) {
            let l = all_links[idx];
            if (l != null && !l.includes('video.') && !l.includes('/video/') && !l.includes('/video?')) {
                let regex = /https?:\/\/(www\.)?(.*(\.com|\.org))(\/)?\.*/gi;
                let link = regex.exec(l);
                //console.log(link, this.url);
                if (link && link.length >= 3 && (link[2].includes(this.url) || this.url.includes(link[2]))) {
                    ret_links.push(l);
                } else if (l.startsWith('/') && l.length > 1) {
                    ret_links.push(this.url + l)
                }
            }
        }
        //mpi.storeSet('ret_links', ret_links);

        this.num_discovered_links += ret_links.length;
        let tmp = this.num_discovered_links;
        mpi.updateStatus({'numDiscoveredLinks': tmp});
        //console.log('retlinks: ' + ret_links)
        return ret_links;
    }

    async makeRequest(url) {
        try {
            let cors_api_url = 'https://cors-anywhere.herokuapp.com/';
            const res = await fetch(cors_api_url + url);
            const response = await res.text();
            return response;
        } catch (error) {
            return console.log('Error:', error);
        }
    }

    /*keywordClean(word) {
        let word = word.replace(/\W/g, '');
        word = word.replace(/\d/g, '');
        if (word == '') {
            return null;
        }
        return word
    }*/

    /*findKeywords(html) {
        let ps = [];
        let endps = [];

        let re = /<p>/g;
        let re2 = /<\/p>/g;

        do {
            m = re.exec(html);
            if (m) {
                ps.push(m);
            }
        } while (m);

        do {
            m = re2.exec(html);
            if (m) {
                endps.push(m);
            }
        } while (m);

        // TODO: nested <p>s 
        for (var idx=0; idx<ps.length; idx++){
            curr_p = ps[idx];
            
        }
    }*/

    async scrape() {
        let r = null;
        try {
            r = await this.makeRequest(this.url);
        } catch {
            console.log("Failed to make requet to " + this.url);
            return [null, null];
        }
        if (r == null) {
            console.log('promise returning null');
            return [null, null];
        }
        //console.log('value of r after makeRequest: '+r);
        let links = this.findLinks(r);
        return [null, links];
    }
}

function sleep(s) {
    return new Promise(resolve => setTimeout(resolve, s * 1000));
}

console.log('starting scraper...');

async function main() {
    mpi.updateStatus({
        projectTitle: 'Link scraper',
        projectDescription: 'An application that continuously scrapes news sources for links',
        taskDescription: 'This node is scraping web pages and parsing them for links to send back to the main node'
    });

    console.log("in main");

    let rank = await mpi.getRank('default');
    console.log(`got rank: ${rank}`);

    let size = await mpi.getSize('default');
    console.log(`got size: ${size}`);

    let sources = new Set(['https://bbc.com', 'https://cincinnati.com', 'https://foxnews.com', 'https://npr.org/sections/news/', 'https://nytimes.com', 'https://forbes.com', 'https://wsj.com', 'https://www.cnn.com/', 'https://www.nbcnews.com/', 'https://abcnews.go.com/', 'https://www.yahoo.com/news/', 'https://www.washingtonpost.com/', 'https://www.theguardian.com/us', 'https://www.latimes.com/', 'https://www.apnews.com/', 'https://www.economist.com/', 'https://www.ap.org/en-us/', 'https://www.reuters.com/', 'https://www.bloomberg.com/', 'https://www.foreignaffairs.com/', 'https://www.theatlantic.com/', 'https://www.politico.com/', 'https://time.com/', 'https://www.cbsnews.com/']);
    //politico, cnn
    //let sources = ['https://www.cnn.com/', 'https://www.politico.com/']
    let outstandingReqs = 0;
    let receiveMessages = [];
    //let explored = new Set();
    //let uniqueKeywords = new Set();
    let stopTime = -1;
    let total = 0;
    let flag = false;
    let batchsize = 10;
    let count = 0;

    let s = new Scrape();


    if (rank === 0) {
        console.log('root sending and receiving links');
        for (let idx = 0; idx < size - 1; idx++) {
            mpi.updateStatus({progress: Math.floor(1/sources.size * 100)});
            receiveMessages.push([idx + 1, mpi.irecv(idx + 1, 'default')]);
            console.log('received from worker: ' + receiveMessages);
            if (sources.size > 0) {
                let tmp = 0;
                let batch = [];
                for(let l of sources){
                    batch.push(l);
                    sources.delete(l);
                    tmp++;
                    if (tmp === batchsize) break;
                }
                mpi.isend(batch, idx + 1, 'default');
                count += batchsize;
                mpi.updateStatus({'numExploredLinks': count});
                outstandingReqs++;
            } else {
                mpi.isend([''], idx + 1, 'default');
            }
        }
        starttime = Date.now();

        console.log('root sending and receiving more links');
        while (outstandingReqs > 0 && (stopTime < 0 || Date() < stopTime)) {
            mpi.updateStatus({progress: Math.floor(1/sources.size * 100)});
            mpi.updateStatus({'lengthSources ': sources.size});
            for (let idx = 0; idx < receiveMessages.length; idx++) {
                let res = await receiveMessages[idx][1];
                //let res = req[1];
                let rec_rank = receiveMessages[idx][0];
                console.log('rank 0 recieved from child: ' + receiveMessages[idx]);
                if (res) {
                    outstandingReqs--;
                    //keywords = res[0];
                    let links_arr = res;


                    if (sources.size > 0) {
                        //console.log('sources: '+sources);
                        let tmp = 0;
                        let batch = [];
                        for(let l of sources){
                            batch.push(l);
                            sources.delete(l);
                            tmp++;
                            if (tmp === batchsize) break;
                        }
                        console.log('sending to child: ' + batch);
                        mpi.isend(batch, rec_rank, 'default');
                        count += batchsize;
                        mpi.updateStatus({'numExploredLinks': count});

                        outstandingReqs++;
                    } else {
                        mpi.isend([''], rec_rank, 'default');
                    }

                    receiveMessages.push(mpi.irecv(rec_rank, 'default'));

                    // for (var jdx = 0; jdx < keywords.length; jdx++) {
                    //     uniqueKeywords.add(keywords[jdx]);
                    // }

                    for (let jdx = 0; jdx < links_arr.length; jdx++) {

                        let links = links_arr[jdx];
                        if (!links) {
                            continue;
                        }
                        total += links.length;
                        if (total >= 5000 && !flag) {
                            flag = true;
                            let t = Date.now() - starttime;
                            mpi.updateStatus({'timeto5k': t});
                            console.log({'timeto5k': t});
                        }

                        for (let kdx = 0; kdx < links.length; kdx++) {
                            let link = links[kdx];

                            console.log('evaluating link: ' + link);
                            //console.log('length of explored: ' + explored.size);
                            //if (!explored.has(link)) {
                            sources.add(link);
                            mpi.updateStatus({'lengthSources ': sources.size});
                                //explored.add(link);
                                /* if (explored.size >= 5000){
                                     mpi.updateStatus({'timeto5kUNIQUE': Date.now()-starttime});
                                     return;
                                 }
                            } else {
                                console.log('repeated link');
                            }*/
                        }
                    }
                }
            }
            // Clean up urls_collection ??? 
        }
    } else {
        console.log('in worker node');

        let local_unique = new Set();

        let it = 0;
        while (stopTime < 0 || Date() < stopTime) {
            it++;
            let source_arr = await mpi.irecv(0, 'default');
            let links = [];
            let keywords = [];
            let len = 0;
            console.log(source_arr);
            if (source_arr == ['']) {
                await sleep(1);
            } else {
                for (let idx = 0; idx < source_arr.length; idx++) {
                    let source = source_arr[idx];
                    let tmp = [];
                    console.log('received link from root ' + source);
                    source = source.trim();
                    let parts = source.split('/');
                    //let baseurl = parts.join('/');
                    s.setUrl(source);
                    let retval = await s.scrape();
                    //console.log('result of scrape: ' + retval)
                    keywords.push(retval[0]);
                    let all_links = retval[1];
                    if (all_links) {
                        for (let jdx = 0; jdx < all_links.length; jdx++) {
                            let curr_link = all_links[jdx];
                            if (!local_unique.has(curr_link)) {
                                tmp.push(curr_link);
                                local_unique.add(curr_link);
                                len++;
                            }
                            //console.log('links discovered: ' + links);
                        }
                    }
                    links.push(tmp)
                }
                console.log('sending discovered links to root ' + len.toString());
                mpi.isend((keywords, links), 0, 'default');
                await sleep(1);
            }
        }
    }
}

let starttime = 0;
main();
