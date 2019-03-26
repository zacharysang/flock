//import { stringify } from "querystring";

// import flock-mpi
importScripts('/static/flock-mpi.js');

//importScripts("collections/set.js");
//importScritps("fs");

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
        var all_links = [];
        var ret_links = [];

        var re = /<a href\s*=\s*"(((?!\s).)*)"/g
        do {
            var m = re.exec(html);
            if (m) {
                all_links.push(m[1]);
            }
        } while (m);

        for(var idx=0; idx<all_links.length; idx++){
            var l = all_links[idx];
            if (l != null && !l.includes('video.') && !l.includes('/video/') && !l.includes('/video?')){
                var regex = /https?:\/\/(www\.)?(.*(\.com|\.org))(\/)?\.*/gi;
                var link = regex.exec(l);
                if (link) {
                    ret_links.push(link);
                }
            } 
        }
        //mpi.storeSet('ret_links', ret_links);
        
        this.num_discovered_links += ret_links.length;
        mpi.updateStatus({num_discovered_links, size});
        return ret_links;
    }

    async makeRequest(url) {
        try {
            const res = await fetch(url);
            const response = await res.text();
            return response;
        }
        catch (error) {
            return console.log('Error:', error);
        }
    }

    keywordClean(word) {
        var word = word.replace(/\W/g, '');
        var word = word.replace(/\d/g, '');
        if (word == '') {
            return null;
        }
        return word
    }

    /*findKeywords(html) {
        var ps = [];
        var endps = [];

        var re = /<p>/g;
        var re2 = /<\/p>/g;

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
        var r = null;
        try {
            r = await this.makeRequest(this.url);
        } catch {
            console.log("Failed to make requet to " + this.url);
            return [null, null];
        }   
        if (r==null) {
            console.log('promise returning null');
            return [null, null];
        }   
        //console.log('value of r after makeRequest: '+r);
        links = this.findLinks(r);
        return [null, links];
    }
}

function sleep(s) {
    return new Promise(resolve => setTimeout(resolve, s*1000));
  }

console.log('starting scraper...');

async function main() {
    console.log("in main");

    let rank = await mpi.getRank('default');
    console.log(`got rank: ${rank}`);

    let size = await mpi.getSize('default');
    console.log(`got size: ${size}`);

    // sources = ['https://bbc.com', 'https://cincinnati.com', 'https://foxnews.com', 'https://npr.org/sections/news/', 'https://nytimes.com', 'https://forbes.com', 'https://wsj.com', 'https://www.cnn.com/', 'https://www.nbcnews.com/', 'https://abcnews.go.com/', 'https://www.yahoo.com/news/', 'https://www.washingtonpost.com/', 'https://www.theguardian.com/us', 'https://www.latimes.com/', 'https://www.apnews.com/', 'https://www.economist.com/', 'https://www.ap.org/en-us/', 'https://www.reuters.com/', 'https://www.bloomberg.com/', 'https://www.foreignaffairs.com/', 'https://www.theatlantic.com/', 'https://www.politico.com/', 'https://time.com/', 'https://www.cbsnews.com/'];
    //politico, cnn
    var sources = ['https://www.cnn.com/', 'https://www.politico.com/']
    var outstandingReqs = 0;
    var receiveMessages = [];
    var explored = new Set();
    var uniqueKeywords = new Set();
    var stopTime = -1;


    s = new Scrape();


    if (rank == 0) {
        console.log('root sending and receiving links');
        for (var idx = 0; idx < size; idx++) {
            receiveMessages.push(mpi.irecv(idx + 1, 'default'));
            if (sources.length > 0) {
                mpi.isend(sources.pop(), idx + 1, 'default');
                outstandingReqs++;
            } else {
                mpi.isend('', idx + 1, 'default');
            }
        }
        
        console.log('root sening and receiving more links');
        while (outstandingReqs > 0 && (stopTime < 0 || Date() < stopTime)) {
            for (var idx = 0; idx < receiveMessages.length; idx++) {
                req = receiveMessages[idx];
            }

            if (res[0]) {
                outstandingReqs--;
                //keywords = res[0];
                links = res[1];

                if (sources.length > 0) {
                    nextLink = sources.pop();
                    mpi.isend(nextLink, idx + 1, 'default');
                    outstandingReqs++;
                } else {
                    mpi.isend('', idx + 1, 'default');
                }

                receiveMessages.push(mip.irecv(idx + 1, 'default'));

                // for (var jdx = 0; jdx < keywords.length; jdx++) {
                //     uniqueKeywords.add(keywords[jdx]);
                // }

                for (var jdx = 0; jdx < links.length; jdx++) {
                    link = links[jdx];
                    if (!explored.has(link)) {
                        sources.push(link);
                        explored.add(link);
                    }
                }
            }

            // Clean up urls_collection ??? 
        }
    } else {
        console.log('in worker node');

        var it = 0;
        while (stopTime < 0 || Date() < stopTime) {
            it++;
            source = await mpi.irecv(0, 'default');
            var links = [];
            var keywords = '';

            if (source == '') {
                await sleep(1);
            } else {
                console.log('received link from root ' + source);
                source = source.trim();
                parts = source.split('/');
                baseurl = parts.join('/');
                s.setUrl(source);
                retval = await s.scrape();
                console.log('result of scrape: ' + retval)
                keywords = retval[0];
                links = retval[1];
                console.log('links discovered: ' + links);
            }
            len = ((links) ? links.length : 0);
            console.log('sending discovered links to root ' + len.toString());
            mpi.isend((keywords, links), 0, 'default');
            await sleep(1);
        }
    }
}

main();