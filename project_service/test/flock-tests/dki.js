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
        // URL to scrape
        this.url = url;
    }

    findLinks(html) {
        let all_links = [];
        let ret_links = [];

        // Grab the all the links from the provided HTML
        let re = /<a href\s*=\s*"(((?!\s).)*)"/g;
        do {
            var m = re.exec(html);
            if (m) {
                all_links.push(m[1]);
            }
        } while (m);

        // Parse these links and remove the ones we're not interested in --
        // No videos, no external links
        for (let idx = 0; idx < all_links.length; idx++) {
            let l = all_links[idx];
            if (l != null && !l.includes('video.') && !l.includes('/video/') && !l.includes('/video?')) {
                let regex = /https?:\/\/(www\.)?(.*(\.com|\.org))(\/)?\.*/gi;
                let link = regex.exec(l);

                // The link must be to the same site as we're currently on
                if (link && link.length >= 3 && (link[2].includes(this.url) || this.url.includes(link[2]))) {
                    ret_links.push(l);
                }
                else if (l.startsWith('/') && l.length > 1) {
                    ret_links.push(this.url + l)
                }
            }
        }

        // Update the UI with the number of discovered links
        this.num_discovered_links += ret_links.length;
        // For some reason JS did not like this.num_discovered_links in the call to updateStatus so had to use
        // intermediate variable
        let tmp = this.num_discovered_links;
        mpi.updateStatus({'Total number of links discovered by this node': tmp});

        // Return the list of links
        return ret_links;
    }

    async makeRequest(url) {
        try {
            // Because we're making requests from a webpage, we need CORS headers at the destinations
            // But nobody has those, so instead we have to send all our requests through this proxy I am hosting
            let cors_api_url = 'https://cors-anywhere.kurtjlewis.com/';
            const res = await fetch(cors_api_url + url);

            // Get the response, check status code, and return the page's text
            const response = await res;
            if (response.status !== 200) {
                console.log(response.status, 'not 200');
            }
            return response.text();
        } catch (error) {
            return console.log('Error:', error);
        }
    }

    keywordClean(word) {
        // Remove nonwords
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

        // Recursively parse p tags
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

        // Read each paragraph and extract the keywords
        for (let i = 0; i < ps.length; i++) {
            let paragraph = ps[i];
            paragraph = paragraph.toLowerCase();

            // Remove non-words
            let words = paragraph.split(/\s/);
            words = words.map(this.keywordClean);

            // Don't bother if the paragraph is short
            if (words.length < 10) continue;

            // Remove stopwords
            for (let idx = 0; idx < words.length; idx++) {
                let word = words[idx];
                if (word && !this.stopWords.has(word)) {
                    keywords.add(word);
                }
            }
        }

        // Return an array of unique keywords
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
    return Math.round(diff / 1000);
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

    let receiveMessages = [];
    let explored = new Set();
    let uniqueKeywords = new Set();
    let total = 0;
    let flag = false;
    let batchsize = 5;
    let count = 0;

    let s = new Scrape();


    if (rank === 0) {

        function sendBatch(dest) {
            let batch = sources.slice(0, batchsize);
            console.log('sending to child: ' + batch, explored.size);
            mpi.isend([uniqueKeywords.size, explored.size, batch], dest, 'default');
            count += batchsize;
            sources = sources.slice(batchsize, sources.length - 1);
        }

        console.log('root sending and receiving links');
        for (let idx = 0; idx < size - 1; idx++) {

            if (sources.length > 0) {
                sendBatch(idx + 1);
                receiveMessages.push([idx + 1, mpi.irecv(idx + 1, 'default')]);

                mpi.updateStatus({
                    progress: {reset: true, increment: Math.floor(uniqueKeywords.size / 2000 * 100)},
                    'Number of sources to scrape': sources.length,
                    'Number of links explored': count
                });
            }
        }

        starttime = Date.now();

        batchsize *= 2;

        let rankToSendTo = 0;

        console.log('root sending and receiving more links');

        while (true) {

            // Monitor for size changes
            let tmp = await mpi.getSize('default');
            console.log(`got size: ${tmp}`);
            if (tmp > size) {
                delta = tmp - size;
                for (idx = 0; idx < delta; idx++) {
                    dest = (tmp - 1) + idx;
                    if (sources.length > 0) {
                        sendBatch(dest);
                        receiveMessages.push([dest, mpi.irecv(dest, 'default')]);
                    }
                }
            }
            size = tmp;

            // Calculate rank to send next batch to
            rankToSendTo = ++rankToSendTo % size;
            if (rankToSendTo === 0) rankToSendTo++;

            // If the promise array is empty, send out some batches
            if (receiveMessages.length <= 0) {
                for (idx = 1; idx < size-1; idx++) {
                    if (sources.length > 0) {
                        sendBatch(idx);
                        receiveMessages.push([dest, mpi.irecv(dest, 'default')]);
                    }
                }
                continue;
            }
            // Grab first promise
            let receivedMessage = receiveMessages.shift();

            // If receivedMessages is empty, send batches out and start again
            if (!receiveMessages) continue;

            let rec_rank = receivedMessage[0];

            // If that promise takes more than 60 seconds to resolve, move on
            let failed = false;
            let res = await Promise.race(
                [receivedMessage[1],
                    new Promise(function (resolve, reject) {
                        setTimeout(() => reject(new Error(`Receive from ${rec_rank} failed`)), 60 * 1000);
                    })
                ]).catch(function (error) {
                console.log(`Receive timed out ${error}`);
                failed = true;
            });
            if (failed || !res) continue;

            console.log('rank 0 received from child: ' + res[0]);

            // Set values from resolved promise
            let keywords = res[0];
            let links_arr = res[1];

            // If there are more sources, send them to the appropriate rank
            if (sources.length > 0) {
                sendBatch(rankToSendTo);
                receiveMessages.push([rankToSendTo, mpi.irecv(rankToSendTo, 'default')]);
            }

            // If we received keywords from the worker, add them to the set
            if (keywords) {
                for (let jdx = 0; jdx < keywords.length; jdx++) {
                    uniqueKeywords.add(keywords[jdx]);
                }
            }

            // Loop through the array of arrays of links
            for (let jdx = 0; jdx < links_arr.length; jdx++) {

                // If we didn't receive links from this link, keep continue
                let links = links_arr[jdx];
                if (links.length <= 0) {
                    continue;
                }

                // increment total links received and update UI when we reach 5000
                total += links.length;
                if (total >= 5000 && !flag) {
                    flag = true;
                    let t = Date.now() - starttime;
                    mpi.updateStatus({'Time to reach 5k unique links discovered': t});
                    console.log({'timeto5k': t});
                }

                // Loop through the links and determine which are unique
                for (let kdx = 0; kdx < links.length; kdx++) {
                    let link = links[kdx];

                    console.log('evaluating link: ' + link);
                    console.log('length of explored: ' + explored.size);

                    // If the link is unique, add it to sources, else ignore it
                    if (!explored.has(link)) {
                        sources.push(link);
                        explored.add(link);
                        mpi.updateStatus({'Number of unique links discovered': explored.size});
                    } else {
                        console.log('repeated link');
                    }
                }
            }

            // Update UI with results from this iteration
            mpi.updateStatus({
                progress: {reset: true, increment: Math.floor(uniqueKeywords.size / 2000 * 100)},
                'Number of sources to scrape': sources.length,
                'Number of unique keywords discovered': uniqueKeywords.size,
                'Number of links explored': count
            });

        }
    } else {
        console.log('in worker node');

        // Initialize some variables
        let local_unique = new Set();
        let time = [0];
        let global_links = [0];
        let global_kws = [0];
        let local_links = [0];
        let [global_keywords, global_explored] = [0, 0];

        let it = 0;

        while (true) {

            it++;

            // Store previous counts so we can check if data has changed
            let [prev_global_keywords, prev_global_explored] = [global_keywords, global_explored];

            // Receive from rank 0
            [global_keywords, global_explored, source_arr] = await mpi.irecv(0, 'default');

            console.log('received from 0: ', global_keywords, global_explored);

            // Check how long it's been since we graphed last
            let last_time = time[time.length - 1];
            let this_time = timeSince(starttime);

            // If the data has changed or it's been more than 10 seconds since the last graph update, update the graph
            let change = prev_global_keywords != global_keywords || prev_global_explored != global_explored || this_time - last_time > 10;
            if (change) {

                // Update the arrays to be graphed
                time.push(this_time);
                global_links.push(global_explored);
                global_kws.push(global_keywords);
                local_links.push(s.num_discovered_links);

                // Build the graph object
                let graph = {
                    type: 'line', data:
                        {
                            labels: time,
                            datasets:
                                [{label: 'Global Unique Links', data: global_links}, {
                                    label: 'Links discovered by this node',
                                    data: local_links
                                }, {label: 'Global Unique Keywords', data: global_kws}]
                        }
                };

                // Update the UI and graph by sending graph object to quickchart.io
                mpi.updateStatus({
                    progress: {reset: true, increment: Math.floor(global_keywords / 2000 * 100)},
                    'Global number of unique links discovered': global_explored,
                    'Global number of unique keywords discovered': global_keywords,
                    image: {
                        type: 'img',
                        src: 'https://quickchart.io/chart?width=1000&height=600&c=' + JSON.stringify(graph),
                        width: 500,
                        height: 300
                    }
                });
            }

            // Start processing received links
            let links = [];
            let keywords = [];
            let len = 0;
            console.log(source_arr);
            if (source_arr == ['']) {
                await sleep(1);
            }
            else {

                // Child receives an array of size <batchsize>, each element of which is a link to explore
                for (let idx = 0; idx < source_arr.length; idx++) {

                    // Trying to avoid rate limiting here
                    await sleep(1);

                    // Look at single link
                    let source = source_arr[idx];
                    console.log(`received link from root ${source}`);

                    let tmp = [];

                    // Trim the whitespace and scrape the URL
                    source = source.trim();
                    s.setUrl(source);
                    let retval = await s.scrape();
                    console.log(`result of scrape: ${retval}`);

                    // Add the newly discovered keywords to the keywords array
                    keywords = keywords.concat(retval[0]);

                    // Add the unique links to the links array
                    let all_links = retval[1];
                    if (all_links) {
                        for (let jdx = 0; jdx < all_links.length; jdx++) {
                            let curr_link = all_links[jdx];
                            if (!local_unique.has(curr_link)) {
                                tmp.push(curr_link);
                                local_unique.add(curr_link);
                                len++;
                            }
                        }
                    }
                    links.push(tmp)
                }
                console.log(`sending ${len.toString()} discovered links to root `);
                console.log(`sending data to root ${keywords}`);

                // Send the discovered data back to root and nap for a second
                mpi.isend([keywords, links], 0, 'default');
                await sleep(1);
            }
        }
    }
}

let starttime = Date.now();
main();
