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

        let re = /<a href\s*=\s*"(((?!\s).)*)"/g
        do {
            let m = re.exec(html);
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

        for (var idx = 0; idx < all_links.length; idx++) {
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
        mpi.updateStatus({ 'numParsedLinks': tmp });
        //console.log('retlinks: ' + ret_links)
        return ret_links;
    }

    async makeRequest(url) {
        try {
            let cors_api_url = 'https://cors-anywhere.herokuapp.com/';
            const res = await fetch(cors_api_url + url);
            const response = await res.text();
            return response;
        }
        catch (error) {
            return console.log('Error:', error);
        }
    }

    keywordClean(word) {
        let word = word.replace(/\W/g, '');
        let word = word.replace(/\d/g, '');
        if (word == '') {
            return null;
        }
        return word
    }

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
    console.log("in main");

    let rank = await mpi.getRank('default');
    console.log(`got rank: ${rank}`);

    let size = await mpi.getSize('default');
    console.log(`got size: ${size}`);

    let sources = ['https://bbc.com', 'https://cincinnati.com', 'https://foxnews.com', 'https://npr.org/sections/news/', 'https://nytimes.com', 'https://forbes.com', 'https://wsj.com', 'https://www.cnn.com/', 'https://www.nbcnews.com/', 'https://abcnews.go.com/', 'https://www.yahoo.com/news/', 'https://www.washingtonpost.com/', 'https://www.theguardian.com/us', 'https://www.latimes.com/', 'https://www.apnews.com/', 'https://www.economist.com/', 'https://www.ap.org/en-us/', 'https://www.reuters.com/', 'https://www.bloomberg.com/', 'https://www.foreignaffairs.com/', 'https://www.theatlantic.com/', 'https://www.politico.com/', 'https://time.com/', 'https://www.cbsnews.com/'];
    //politico, cnn
    //let sources = ['https://www.cnn.com/', 'https://www.politico.com/']
    let outstandingReqs = 0;
    let receiveMessages = [];
    let explored = new Set();
    let uniqueKeywords = new Set();
    let stopTime = -1;
    let total = 0;
    let flag = false;

    let s = new Scrape();


    if (rank == 0) {
        console.log('root sending and receiving links');
        for (var idx = 0; idx < size - 1; idx++) {
            receiveMessages.push([idx + 1, mpi.irecv(idx + 1, 'default')]);
            console.log('received from worker: ' + receiveMessages);
            if (sources.length > 0) {
                let blobsize = Math.floor(sources.length / (size - 1));
                let blob = sources.slice(0, blobsize);
                mpi.isend(blob, idx + 1, 'default');
                sources = sources.slice(blobsize, sources.length - 1)
                outstandingReqs++;
            } else {
                mpi.isend([''], idx + 1, 'default');
            }
        }
        starttime = Date.now();

        console.log('root sending and receiving more links');
        while (outstandingReqs > 0 && (stopTime < 0 || Date() < stopTime)) {
            for (var idx = 0; idx < receiveMessages.length; idx++) {
                let res = await receiveMessages[idx][1];
                //let res = req[1];
                let rec_rank = receiveMessages[idx][0];
                console.log('rank 0 recieved from child: ' + receiveMessages[idx])
                if (res) {
                    outstandingReqs--;
                    //keywords = res[0];
                    links = res;

                    total += links.length;
                    if (total >= 5000 && !flag) {
                        flag = true;
                        let t = Date.now() - starttime;
                        mpi.updateStatus({ 'timeto5k': t });
                        console.log({ 'timeto5k': t });
                    }

                    if (sources.length > 0) {
                        //console.log('sources: '+sources);
                        let blobsize = Math.floor(sources.length / (size - 1));
                        let blob = sources.slice(0, blobsize);
                        console.log('sending to child: ' + blob);
                        mpi.isend(blob, rec_rank, 'default');
                        sources = sources.slice(blobsize, sources.length - 1)

                        outstandingReqs++;
                    } else {
                        mpi.isend([''], rec_rank, 'default');
                    }

                    receiveMessages.push(mpi.irecv(rec_rank, 'default'));

                    // for (var jdx = 0; jdx < keywords.length; jdx++) {
                    //     uniqueKeywords.add(keywords[jdx]);
                    // }

                    for (var jdx = 0; jdx < links.length; jdx++) {
                        link = links[jdx];

                        console.log('evaluating link: ' + link);
                        console.log('length of explored: ' + explored.size);
                        if (!explored.has(link)) {
                            sources.push(link);
                            explored.add(link);
                            mpi.updateStatus({ 'numExploredLinks': explored.length });
                            // if (explored.size >= 5000){
                            //     mpi.updateStatus({'timeto5kUNIQUE': Date.now()-starttime});
                            //     return;
                            // }
                        }
                        else {
                            console.log('repeated link');
                        }
                    }
                }
            }
            // Clean up urls_collection ??? 
        }
    } else {
        console.log('in worker node');

        let it = 0;
        while (stopTime < 0 || Date() < stopTime) {
            it++;
            let source_arr = await mpi.irecv(0, 'default');
            let links = [];
            let keywords = '';

            if (source_arr == ['']) {
                await sleep(1);
            } else {
                for (var idx = 0; idx < source_arr.length; idx++) {
                    let source = source_arr[idx];
                    console.log('received link from root ' + source);
                    source = source.trim();
                    parts = source.split('/');
                    baseurl = parts.join('/');
                    s.setUrl(source);
                    retval = await s.scrape();
                    //console.log('result of scrape: ' + retval)
                    keywords.push(retval[0]);
                    links.push(retval[1]);
                    //console.log('links discovered: ' + links);
                }
            }
            len = ((links) ? links.length : 0);
            console.log('sending discovered links to root ' + len.toString());
            mpi.isend((keywords, links), 0, 'default');
            await sleep(1);
        }
    }
}

let starttime = 0;
main();
