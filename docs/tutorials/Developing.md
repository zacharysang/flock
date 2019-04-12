# Overview

Flock provides a means for you to distribute a workload over a cluster of 
browser tabs which are provided by volunteers. This includes establishing and 
maintaining connections between nodes in the cluster, as well as sending 
reliable messages between these nodes. As a part of this the `flock-mpi.js` is
made available to developers to provide you with high-level distributed computing
functions such as `scatter` (spread an array over the nodes of the cluster),
`gather` (collect data from all nodes in the cluster into an array), etc. 
By importing this library into flock applications, developers are able to
utilize more expressive control over the work compeleted on the cluster.

# Using flock-mpi.js

To fully leverage flock, developers can use 'flock-mpi.js' to communicate
between nodes in a variety of ways. To utilize this script, simply import it 
using the [importScripts](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts) function.
This can be done by including the following line of code at the top of your application:
```
importScripts('/static/flock-mpi.js');
```
Once this is done, all of the api functions documented in the `mpi` namespace of
this site will be available to you.

# Keeping your volunteers in the loop with updateStatus

In order to make execution of your flock application possible. Volunteers will 
be keeping a browser tab open to execute your code. For this reason it is 
helpful to be transparent about your application. Not only does this build trust
and transparency, but also makes each volunteer feel more involved and engaged 
with your work. The result of this is that volunteers feel rewarded for their 
contribution, which may result in them staying online for longer and donating 
more in the future.

The primary way to share information with volunteers is through `mpi.updateStatus`.
This functions gives you a way to comunicate certain details and statistics about 
your application to the volunteer. This function takes a dictionary where keys 
correspond to field names, and values are the data shown to the user. You can
specify custom field names, but can also use reserved field names such as 
projectTitle or projectDescription. Reserved field names are documented more in 
[the generated docs](https://zacharysang.com/flock/mpi.html#.updateStatus).


## Reserved fields

The first step when using this function is to
fill in details for the reserved fields such as projectTitle, 
projectDescription, and taskDescription, which give the volunteer an overview of
the nature of the application. You can check out the docs linked above for more
details, but an example showing how these details can be displayed is shown below:

```
mpi.updateStatus({
    projectTitle: 'Laps',
    projectDescription: 'An io-heavy application to test sending and receiving p2p messages using easyrtc and flock',
    taskDescription: 'This node is participating in a loop of nodes sending and receiving messages from each other. Each message updates the value of "a"'
});
```


## Updating progress
An important reserved field name is `progress`. This allows the developer to 
give the volunteer some insight into how much progress they are contributing.
To the value corresponding to the `progress` field name is an object with the 
required attribute, `increment`. This is the amount to increase the progress bar by.
This object can also include an optional `reset` attribute. If this is given to be true,
the progress bar will be reset before applying the increment, which effectively
ensures that the given increment value will be the value displayed to the 
volunteer. Below is an example of progress being updated in a flock app. In this
example, progress is simply being incremented for each iteration of a loop

```
while(true) {
    await mpi.ibarrier('default');
    
    mpi.updateStatus({progress: {increment: 1}});
}
```

Additionally, here is an example of progress being updated with the reset attribute.
This is useful for cases where progress is tracked as an absolute value (instead
of being incrementally advanced). In this case, the progress is being updated 
to reflect the progress towards a certain target value:

```
mpi.updateStatus({
    progress: {reset: true, increment: Math.floor(uniqueKeywords.size / 2000 * 100)}
});
```


## Visuals - Images and SVGs

By default, values are interpretted as text and displayed on the page.
However, the values given to this function can also be images or svg. To specify an 
image (or svg) the value should be an object with a `type` attribute 
(`img` for images, `svg` for svgs). Furthermore, the `src` attribute must be 
provided to give the url where the image is located. In the case that the image 
is available locally instead of on a remote host, developers are able to use
the [URL.createObjectURL](https://developer.mozilla.org/en/docs/Web/API/URL/createObjectURL) 
function. This will provide you the url to the locally hosted file which can be used
under the `src` attribute. Below is an example of images being displayed to the user.
More details can be found under the docs linked above.

```
// pull down a test image to display
// This could be passed directly, but is being fetched for the purpose of demonstrating use of URL.createObjectURL
fetch('https://images.pexels.com/photos/755385/pexels-photo-755385.jpeg?cs=srgb&dl=backlit-bird-clouds-755385.jpg&fm=jpg')
.then((res) => {
   if (res.ok) {
       return res.blob();
   } 
})
.then((imgBlob) => {
    let url = URL.createObjectURL(imgBlob);
    mpi.updateStatus({image: {type: 'img', src: url, width: 150, height: 150}});
});
```