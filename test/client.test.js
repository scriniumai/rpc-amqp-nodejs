var test = require('tape')
var RpcClient = require('lib/rpc/client')

function fakeQueue (name) {
  return {
    name,
    subscribe: (params, cb) => {
      var correlationId = name.split('.').pop() // hack for getting actual correlationId
      var responseRaw = {
        correlationId,
        data: JSON.stringify({
          status: 200,
          data: { responseParam: 222 }
        })
      }
      var headers = {}
      var deliveryInfo = {}
      var messageObject = {
        acknowledge: (all) => {}
      }

      var response = {
        callbacks: [],
        addCallback: function (subscribeCallback) {
          this.callbacks.push(subscribeCallback)
        }
      }

      setTimeout(function () {
        response.callbacks.map((subscribeCallback) => subscribeCallback('ctag'))
        cb(responseRaw, headers, deliveryInfo, messageObject)
      }, 0)

      return response
    },
    unsubscribe: () => {},
    destroy: () => {},
    bind: () => {}
  }
}

function fakeAmqpConnection (buildQueue = fakeQueue) {
  return {
    channels: [''],
    connection: {},
    events: {},
    on: function (event, cb) {
      this.events[event] = cb
    },
    queue: (name, params, cb) => cb(buildQueue(name, params)),
    exchange: (name, params, cb) => {
      cb({
        name,
        publish: () => {}
      })
    }
  }
}

test('test correct response', t => {
  // create amqpConnection
  var amqpConnection = fakeAmqpConnection()

  t.plan(2)

  var rpcClient = new RpcClient(amqpConnection)
  rpcClient.call('test.call', {requestParam: 111})
    .then(response => {
      t.deepEqual(response.status, 200)
      t.deepEqual(response.data, {responseParam: 222})
    })
})

test('Error when correlationId is not same for request and response', t => {
  // create amqpConnection with wrong correlationId for response
  var amqpConnection = fakeAmqpConnection(
    fakeQueue.bind(null, 'queue:test.callResponse.wrongCorrelationId')
  )

  t.plan(1)

  var rpcClient = new RpcClient(amqpConnection)
  rpcClient.call('test.call', {requestParam: 111})
    .catch(err => {
      t.deepEqual(err.constructor, Error, 'should process with Error')
    })
})

test('Correct work when amqpConnection wakes up with delay', t => {
  const TIMEOUT = 100
  var started = Date.now()

  // create amqpConnection without active channels
  var amqpConnection = fakeAmqpConnection()
  amqpConnection.channels = null

  t.plan(2)

  var rpcClient = new RpcClient(amqpConnection)
  rpcClient.call('test.call', {requestParam: 111})
    .then(response => {
      t.ok(response !== null)
      t.ok(Date.now() - started >= TIMEOUT)
    })

  // amqpConnection is ready after TIMEOUT
  setTimeout(() => { amqpConnection.events['ready'].call() }, TIMEOUT)
})

test('Error when amqpConnection is not ready in connection timeout', t => {
  const TIMEOUT = 100
  var started = Date.now()

  // create amqpConnection without active channels
  var amqpConnection = fakeAmqpConnection()
  amqpConnection.channels = null

  t.plan(2)

  var rpcClient = new RpcClient(amqpConnection, {connectionTimeout: TIMEOUT})
  rpcClient.call('test.call', {requestParam: 111})
    .catch(err => {
      t.deepEqual(err.constructor, Error) // Connection timeout error
      t.ok(Date.now() - started >= TIMEOUT)
    })
})

test('Error when request timeout is expired', t => {
  const TIMEOUT = 200
  var started = Date.now()

  // create amqpConnection with queue which never answers
  function fakeQueue (name) {
    return {
      name,
      subscribe: (params, cb) => {
        var response = {
          callbacks: [],
          addCallback: function (subscribeCallback) {
            this.callbacks.push(subscribeCallback)
          }
        }

        setTimeout(function () {
          response.callbacks.map((subscribeCallback) => subscribeCallback('ctag'))
          // cb() - callback never calls
        }, 0)

        return response
      }, // queue never answers
      unsubscribe: () => {},
      destroy: () => t.ok(true, 'Queue should be deleted'),
      bind: () => {}
    }
  }
  var amqpConnection = fakeAmqpConnection(fakeQueue)

  t.plan(3)

  var rpcClient = new RpcClient(amqpConnection, {requestTimeout: TIMEOUT})
  rpcClient.call('test.call', {requestParam: 111})
    .catch(err => {
      t.deepEqual(err.constructor, Error) // Request timeout error
      t.ok(Date.now() - started >= TIMEOUT)
    })
})

test('test ack message and remove queue on success response', t => {
  // create amqpConnection with checking for queue.destroy and message.acknowledge
  function fakeQueue (name) {
    return {
      name,
      unsubscribe: () => {},
      subscribe: (params, cb) => {
        var correlationId = name.split('.').pop()
        var responseRaw = {
          correlationId,
          data: JSON.stringify({
            status: 200, data: { responseParam: 222 }
          })
        }
        var headers = {}
        var deliveryInfo = {}
        var messageObject = {
          acknowledge: (all) => t.ok(true, 'Message should be acknowledged')
        }
        return cb(responseRaw, headers, deliveryInfo, messageObject)
      },
      destroy: () => t.ok(true, 'Queue should be deleted'),
      bind: () => {}
    }
  }
  var amqpConnection = fakeAmqpConnection(fakeQueue)

  t.plan(2) // queue.destroy and message.acknowledge

  var rpcClient = new RpcClient(amqpConnection)
  rpcClient.call('test.call', {requestParam: 111})
})
