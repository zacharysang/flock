<a name="mpi"></a>

## mpi : <code>object</code>
This module is to be imported by either a browser WebWorker or a nodejs worker-thread

If imported by a WebWorker, it will simply be executed. For this reason `mpi` is in the global scope so that it is available after being imported.

On the other hand, if imported by a worker-thread, it will be imported using nodejs' module system (using module.exports)

**Kind**: global namespace  

* [mpi](#mpi) : <code>object</code>
    * [.getRank(comm)](#mpi.getRank) ⇒ <code>number</code>
    * [.getSize(comm)](#mpi.getSize) ⇒ <code>number</code>
    * [.isend(data, dest, comm, tag)](#mpi.isend) ⇒ <code>number</code>
    * [.irecv(source, comm, tag)](#mpi.irecv) ⇒ <code>serializable</code>
    * [.ibarrier(comm)](#mpi.ibarrier)
    * [.ibcast(data, root, comm)](#mpi.ibcast) ⇒ <code>serializable</code>
    * [.iscatter(sendArr, root, comm)](#mpi.iscatter) ⇒ <code>array</code>
    * [.ireduce(sendArr, op, comm)](#mpi.ireduce) ⇒ <code>serializable</code>

<a name="mpi.getRank"></a>

### mpi.getRank(comm) ⇒ <code>number</code>
Get the rank of this node in 'comm'

**Kind**: static method of [<code>mpi</code>](#mpi)  
**Returns**: <code>number</code> - Rank for this node under the given communication group  

| Param | Type | Description |
| --- | --- | --- |
| comm | <code>string</code> | Name of the communication group to get this node's rank from |

<a name="mpi.getSize"></a>

### mpi.getSize(comm) ⇒ <code>number</code>
Get the size of the given communicting group, 'comm'

**Kind**: static method of [<code>mpi</code>](#mpi)  
**Returns**: <code>number</code> - - Size of the given communication group  

| Param | Type | Description |
| --- | --- | --- |
| comm | <code>string</code> | Name of the communication group to get the size of |

<a name="mpi.isend"></a>

### mpi.isend(data, dest, comm, tag) ⇒ <code>number</code>
Send data to another node

**Kind**: static method of [<code>mpi</code>](#mpi)  
**Returns**: <code>number</code> - Status code of the acknowledgement for this message  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>stringifiable</code> | Data to be sent to the remote node. Must be able to be serialized using JSON.stringify() |
| dest | <code>number</code> | Rank of the destination node |
| comm | <code>string</code> | Name of the communication group that the current node and destination node are a part of |
| tag | <code>string</code> | (optional) A string used to uniquely identify this message (avoids conflicts if other messages are sent between these nodes at the same time) |

<a name="mpi.irecv"></a>

### mpi.irecv(source, comm, tag) ⇒ <code>serializable</code>
Send a request to the main thread to receive an mpi message

**Kind**: static method of [<code>mpi</code>](#mpi)  
**Returns**: <code>serializable</code> - The received value  

| Param | Type | Description |
| --- | --- | --- |
| source | <code>number</code> | Rank of the node we are expecting data from |
| comm | <code>string</code> | Name of the communication group the data is being sent under |
| tag | <code>string</code> | (optional) A string used to uniquely identify this message (avoids conflicts if other messages are sent between these nodes at the same time) |

<a name="mpi.ibarrier"></a>

### mpi.ibarrier(comm)
Synchronize node executions in a given communication group

**Kind**: static method of [<code>mpi</code>](#mpi)  

| Param | Type | Description |
| --- | --- | --- |
| comm | <code>string</code> | Name of the communication group to synchronize |

<a name="mpi.ibcast"></a>

### mpi.ibcast(data, root, comm) ⇒ <code>serializable</code>
Broadcast a value from a root node to all nodes in a group

**Kind**: static method of [<code>mpi</code>](#mpi)  
**Returns**: <code>serializable</code> - The value broadcasted from root  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>serializable</code> | Value to broadcast (only used if rank === 0) |
| root | <code>number</code> | Rank of the node with the data |
| comm | <code>string</code> | : Name of the communication group to broadcast across |

<a name="mpi.iscatter"></a>

### mpi.iscatter(sendArr, root, comm) ⇒ <code>array</code>
Scatter an array from a root node to all nodes in a group

**Kind**: static method of [<code>mpi</code>](#mpi)  
**Returns**: <code>array</code> - A slice of the given array to each node  

| Param | Type | Description |
| --- | --- | --- |
| sendArr | <code>array</code> | Array to send across the communication group (only used if rank === root) |
| root | <code>number</code> | Rank of the node to send from |
| comm | <code>string</code> | Name of the communication group to send array over |

<a name="mpi.ireduce"></a>

### mpi.ireduce(sendArr, op, comm) ⇒ <code>serializable</code>
Reduce values using a given binary operation

**Kind**: static method of [<code>mpi</code>](#mpi)  
**Returns**: <code>serializable</code> - - Result of the reduction is given to the node with rank === 0, other nodes will receive `undefined`  

| Param | Type | Description |
| --- | --- | --- |
| sendArr | <code>array</code> | Array to reduce using op |
| op | <code>function</code> | A symmetric function that takes 2 arguments (associative and binary) |
| comm | <code>string</code> | Name of the communication group to operate under |

