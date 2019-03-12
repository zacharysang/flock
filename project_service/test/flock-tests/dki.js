// import flock-mpi
importScripts('/static/flock-mpi.js');
importScripts('scrape.js')

importScripts("collections/set");
importScritps("fs");

class Scrape {
    constructor(url, collection) {
        this.url = url;
        this.collection = collection;

        readFileSync('stop-words.txt', { encoding: 'utf-8' }, function (err, data) {
            if (!err) {
                this.stopWords = Set();
                for (var idx = 0; idx < keywords.length; idx++) {
                    this.stopWords.add(keywords[idx]);
                }
            } else {
                // pass
            }
        });
    }

    setUrl(url) {
        this.url = url;
    }

    findLinks(html) {
        var all_links = [];
        var ret_links = [];

        var re = /<a href\s*=\s*"(((?!\s).)*)"/g
        do {
            m = re.exec(html);
            if (m) {
                all_links.push(m[1]);
            }
        } while (m);

        for(var idx=0; idx<all_links.length; idx++){
            var l = all_links[idx];
            if (l != null && !l.includes('video.') && !l.includes('/video/') && !l.includes('/video?')){
                var regex = /http[s]?:\/\/(www\.)?(.*(\.com|\.org))(\/)?\.*/gi;
                link = regex.exec(l);
                if (link) {
                    ret_links.push(link);
                }
            } 
        }

        return ret_links;
    }

    makeRequest(url) {
        fetch(url).then(res => res.json())
            .then(function (response) { return response })
            .catch(error => console.error('Error:', error));
    }

    keywordClean(word) {
        var word = word.replace(/\W/g, '');
        var word = word.replace(/\d/g, '');
        if (word == '') {
            return null;
        }
        return word
    }

    findKeywords(html) {
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
    }
}


console.log('starting scraper...');

async function main() {
    let rank = await mpi.getRank('default');
    console.log(`got rank: ${rank}`);

    let size = await mpi.getSize('default');
    console.log(`got size: ${size}`);

    sources = ['https://bbc.com', 'https://cincinnati.com', 'https://foxnews.com', 'https://npr.org/sections/news/', 'https://nytimes.com', 'https://forbes.com', 'https://wsj.com', 'https://www.cnn.com/', 'https://www.nbcnews.com/', 'https://abcnews.go.com/', 'https://www.yahoo.com/news/', 'https://www.washingtonpost.com/', 'https://www.theguardian.com/us', 'https://www.latimes.com/', 'https://www.apnews.com/', 'https://www.newyorker.com/', 'https://www.economist.com/', 'https://www.ap.org/en-us/', 'https://www.reuters.com/', 'https://www.bloomberg.com/', 'https://www.foreignaffairs.com/', 'https://www.theatlantic.com/', 'https://www.politico.com/', 'http://time.com/', 'https://www.cbsnews.com/']

    var outstandingReqs = 0;
    var receiveMessages = [];
    var explored = Set();
    var uniqueKeywords = Set();

    if (rank == 0) {

        for (var idx = 0; idx < size; idx++) {
            receiveMessages.push(mpi.irecv(idx + 1, 'default'));
            if (sources.length > 0) {
                mpi.isend(idx + 1, sources.pop(), 'default');
            } else {
                mpi.isend(idx + 1, '', 'default');
            }
        }

        while (outstandingReqs > 0 && (stopTime < 0 || Date() < stopTime)) {
            for (var idx = 0; idx < receiveMessages.length; idx++)
                req = receiveMessages[idx];
            res = (true, []);
            try {
                res = req.test();
            } catch { }

            if (res[0]) {
                outstandingReqs--;
                keywords = res[1][0];
                links = res[1][1];

                if (sources.length > 0) {
                    nextLink = sources.pop();
                    mpi.isend(idx + 1, nextLink, 'default');
                    outstandingReqs++;
                } else {
                    mpi.isend(idx + 1, '', 'default');
                }

                receiveMessages.push(mip.irecv(idx + 1, 'default'));

                for (var jdx = 0; jdx < keywords.length; jdx++) {
                    uniqueKeywords.add(keywords[jdx]);
                }

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
        var it = 0;
        while (stopTime < 0 || Date() < stopTime) {
            it++;
            source = await mpi.irecv(0, 'default');
            var links = [];

            if (source == '') {
                await sleep(1);
            } else {
                source = source.trim();
                parts = source.split('/');
                baseurl = parts.join('/');
                s.setUrl(source);
                retval = s.scrape()
            }
            mpi.isend(0, (keywords, links), 'default');
            await sleep(1);
        }
    }
}

main();