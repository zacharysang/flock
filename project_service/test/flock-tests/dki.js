importScripts('/static/flock-mpi.js');

console.log('init dki.js');

class Scrape {
    constructor(url) {
        this.url = url;
        //this.collection = collection;
        this.num_discovered_links = 0;

        // stopwords courtesy of Alireza Savand
        this.stopWords = new Set(["a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves", "new", "will", "also", "can", "may", "like", "said", "make", "just", "many", "get", "now", "since", "including", "last", "made", "around", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "well", "even", "way", "much", "across", "says", "back", "among", "next", "said", "could", "in", "else", "maybe", "tells", "got", "gotten", "huge", "seem", "others", "per", "instead", "either", "uses", "use", "via", "yet"])
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
        mpi.updateStatus({'Total number of links discovered by this node': tmp});
        return ret_links;
    }

    async makeRequest(url) {
        try {
            let cors_api_url = 'https://cors-anywhere.herokuapp.com/';
            const res = await fetch(cors_api_url + url);
            const response = await res;
            if(response.status!==200)
            {
                console.log(response.status, 'not 200');
                /*if (response.status === 429){
                    console.log(response.status, 'waiting 5 seconds');
                    await sleep(5);
                }*/
            }
            return response.text();
        } catch (error) {
            return console.log('Error:', error);
        }
    }

    keywordClean(word) {
        word = word.replace(/\W/g, '');
        word = word.replace(/\d/g, '');
        if (word == '') {
            return null;
        }
        return word
    }

    findKeywords(html) {
        let keywords = new Set();
        let ps = [];


        function rec(html) {
            let re = /<p.*>(.*)<\/p>/g;

            let m = null;

            do {
                m = re.exec(html);
                if (m) {
                    if (m[1]) {
                        ps.push(m[1]);
                        rec(m[1])
                    }
                }
            } while (m)
        }

        rec(html);

        for (let i = 0; i < ps.length; i++) {
            let paragraph = ps[i];
            paragraph = paragraph.toLowerCase();

            let words = paragraph.split(/\s/);
            words = words.map(this.keywordClean);

            if (words.length < 10) continue;

            for (let idx = 0; idx < words.length; idx++) {
                let word = words[idx];
                if (word && !this.stopWords.has(word)) {
                    keywords.add(word);
                }
            }
        }
        return Array.from(keywords);

    }

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
        let keywords = this.findKeywords(r);
        console.log("in scrape, keywords= " + keywords);
        return [keywords, links];
    }
}

function sleep(s) {
    return new Promise(resolve => setTimeout(resolve, s * 1000));
}

function timeSince(starttime) {
    let diff = Date.now() - starttime;
    return Math.round(diff/1000);
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

    let sources = ['https://bbc.com', 'https://cincinnati.com', 'https://foxnews.com', 'https://npr.org/sections/news/', 'https://nytimes.com', 'https://forbes.com', 'https://wsj.com', 'https://www.cnn.com/', 'https://www.nbcnews.com/', 'https://abcnews.go.com/', 'https://www.yahoo.com/news/', 'https://www.washingtonpost.com/', 'https://www.theguardian.com/us', 'https://www.latimes.com/', 'https://www.apnews.com/', 'https://www.economist.com/', 'https://www.ap.org/en-us/', 'https://www.reuters.com/', 'https://www.bloomberg.com/', 'https://www.foreignaffairs.com/', 'https://www.theatlantic.com/', 'https://www.politico.com/', 'https://time.com/', 'https://www.cbsnews.com/'];

    let outstandingReqs = 0;
    let receiveMessages = [];
    let explored = new Set();
    let uniqueKeywords = new Set();
    let stopTime = -1;
    let total = 0;
    let flag = false;
    let batchsize = 10;
    let count = 0;

    let s = new Scrape();


    if (rank === 0) {
        console.log('root sending and receiving links');
        for (let idx = 0; idx < size - 1; idx++) {
            mpi.updateStatus({
                progress: {reset: true, increment: Math.floor(uniqueKeywords.size / 2000 * 100)},
                'Number of sources to scrape': sources.length
            });
            receiveMessages.push([idx + 1, mpi.irecv(idx + 1, 'default')]);
            console.log('received from worker: ' + receiveMessages);
            if (sources.length > 0) {
                let batch = sources.slice(0, batchsize);
                console.log('sending to child: ' + batch, explored.size);
                mpi.isend([uniqueKeywords.size, explored.size, batch], idx + 1, 'default');
                count += batchsize;
                mpi.updateStatus({'Number of links explored': count});
                sources = sources.slice(batchsize, sources.length - 1);
                outstandingReqs++;
            } else {
                mpi.isend([uniqueKeywords.size, explored.size, ['']], idx + 1, 'default');
            }
        }
        starttime = Date.now();

        console.log('root sending and receiving more links');
        while (outstandingReqs > 0 && (stopTime < 0 || Date() < stopTime)) {
            for (let idx = 0; idx < receiveMessages.length; idx++) {
                mpi.updateStatus({
                    progress: {reset: true, increment: Math.floor(uniqueKeywords.size / 2000 * 100)},
                    'Number of sources to scrape': sources.length
                });
                let res = await receiveMessages[idx][1];
                //let res = req[1];
                let rec_rank = receiveMessages[idx][0];
                console.log('rank 0 received from child: ' + res[0]);
                if (res) {
                    outstandingReqs--;
                    let keywords = res[0];
                    let links_arr = res[1];


                    if (sources.length > 0) {
                        let batch = sources.slice(0, batchsize);
                        console.log('sending to child: ' + batch, explored.size);
                        mpi.isend([uniqueKeywords.size, explored.size, batch], rec_rank, 'default');
                        count += batchsize;
                        mpi.updateStatus({'Number of links explored': count});
                        sources = sources.slice(batchsize, sources.length - 1);

                        outstandingReqs++;
                    } else {
                        mpi.isend([uniqueKeywords.size, explored.size, ['']], rec_rank, 'default');
                    }
                    mpi.updateStatus({'Number of sources to scrape': sources.length});


                    receiveMessages.push([rec_rank, mpi.irecv(rec_rank, 'default')]);

                    if (keywords) {
                        for (let jdx = 0; jdx < keywords.length; jdx++) {
                            uniqueKeywords.add(keywords[jdx]);
                        }
                    }

                    mpi.updateStatus({'Number of unique keywords discovered': uniqueKeywords.size});

                    for (let jdx = 0; jdx < links_arr.length; jdx++) {

                        let links = links_arr[jdx];
                        if (!links) {
                            continue;
                        }
                        total += links.length;
                        if (total >= 5000 && !flag) {
                            flag = true;
                            let t = Date.now() - starttime;
                            mpi.updateStatus({'Time to reach 5k unique links discovered': t});
                            console.log({'timeto5k': t});
                        }

                        for (let kdx = 0; kdx < links.length; kdx++) {
                            let link = links[kdx];

                            console.log('evaluating link: ' + link);
                            console.log('length of explored: ' + explored.size);
                            if (!explored.has(link)) {
                                sources.push(link);
                                explored.add(link);
                                // if (explored.size >= 5000){
                                //     mpi.updateStatus({'timeto5kUNIQUE': Date.now()-starttime});
                                //     return;
                                // }
                            } else {
                                console.log('repeated link');
                            }
                            mpi.updateStatus({'Number of unique links discovered': explored.size});
                        }
                    }
                }
            }
            // Clean up urls_collection ??? 
        }
    } else {
        console.log('in worker node');

        let local_unique = new Set();

        let time = [0];
        let global_links = [0];
        let global_kws = [0];
        let local_links = [0];
        let [global_keywords, global_explored] = [0,0];

        let it = 0;
        while (stopTime < 0 || Date() < stopTime) {

            it++;
            let [prev_global_keywords, prev_global_explored] = [global_keywords, global_explored];
            
            [global_keywords, global_explored, source_arr] = await mpi.irecv(0, 'default');

            console.log('received from 0: ', global_keywords, global_explored);

            let last_time = time[time.length-1];
            let this_time = timeSince(starttime);

            // If the data has changed or it's been more than 10 seconds, update the graph
            let change = prev_global_keywords!=global_keywords || prev_global_explored!=global_explored || this_time-last_time > 10 ;
            if (change) {
                time.push(this_time);
                global_links.push(global_explored);
                global_kws.push(global_keywords);
                local_links.push(s.num_discovered_links);
            }
            let graph = {
                type:'line', data:
                {
                    labels: time,
                    datasets:
                    [ {label: 'Global Unique Links', data: global_links }, {label: 'Links discovered by this node', data: local_links }, {label: 'Global Unique Keywords', data: global_kws } ]
                }
            };


            mpi.updateStatus({
                progress: {reset: true, increment: Math.floor(global_keywords / 2000 * 100)},
                'Global number of unique links discovered': global_explored,
                'Global number of unique keywords discovered': global_keywords,
                image: {
                    type: 'img',
                    src: 'https://quickchart.io/chart?width=1000&height=600&c='+JSON.stringify(graph),
                    width: 500,
                    height: 300
                }
            });


            let links = [];
            let keywords = [];
            let len = 0;
            console.log(source_arr);
            if (source_arr == ['']) {
                await sleep(1);
            } else {
                for (let idx = 0; idx < source_arr.length; idx++) {
                    //await sleep(1);
                    let source = source_arr[idx];
                    let tmp = [];
                    console.log('received link from root ' + source);
                    source = source.trim();
                    //let parts = source.split('/');
                    //let baseurl = parts.join('/');
                    s.setUrl(source);
                    let retval = await s.scrape();
                    console.log('result of scrape: ' + retval)
                    keywords = keywords.concat(retval[0]);
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
                console.log('sending data to root ' + keywords);
                mpi.isend([keywords, links], 0, 'default');
                await sleep(1);
            }
        }
    }
}

let starttime = Date.now();
main();
