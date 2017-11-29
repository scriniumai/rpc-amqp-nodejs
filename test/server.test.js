var test = require('tape')
var RpcServer = require('lib/rpc/server')
var amqpHelper = require('lib/rpc/amqp-helper')

function fakeQueue (name) {
  return {
    name,
    cb: () => {},
    subscribe: function (params, cb) {
      var correlationId = name.split('.').pop() // hack for getting actual correlationId
      var responseRaw = {
        data: JSON.stringify({
          correlationId,
          data: JSON.stringify({
            status: 200,
            data: { responseParam: 222 }
          })
        })
      }
      var headers = {}
      var deliveryInfo = {}
      var messageObject = { acknowledge: (all) => {} }

      this.cb = cb.bind(null, responseRaw, headers, deliveryInfo, messageObject)
    },
    destroy: () => {},
    unsubscribe: () => {},
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
    queues: {},
    queue: function (name, params, cb) {
      if (!this.queues.hasOwnProperty(name)) {
        this.queues[name] = buildQueue(name, params)
      }
      cb(this.queues[name])
    },
    exchanges: {},
    exchange: function (name, params, cb) {
      if (!this.exchanges.hasOwnProperty(name)) {
        this.exchanges[name] = { name, publish: () => {} }
      }
      cb(this.exchanges[name])
    }
  }
}

test('test subscribe and calling function', t => {
  amqpHelper.clearCache()

  // create amqpConnection
  var amqpConnection = fakeAmqpConnection()

  t.plan(2)

  var rpcServer = new RpcServer(amqpConnection)
  rpcServer.on('test.call', (response, cb) => t.ok(true, 'Callback was called'))

  setTimeout(() => { // amqp ready after
    amqpConnection.queue('queue:test.call', {}, (queue) => {
      queue.cb() // emulate response from queue x2
      queue.cb()
    })
  }, 100)
})

test('test sending response', t => {
  amqpHelper.clearCache()

  // create amqpConnection
  var amqpConnection = fakeAmqpConnection()
  amqpConnection.exchanges['queue:test.callResponse'] = {
    name: 'queue:test.callResponse',
    publish: () => {
      t.ok(true, 'Sending response to exchange')
    }
  }

  t.plan(1) // check only that response was sent to exchange

  var rpcServer = new RpcServer(amqpConnection)
  rpcServer.on('test.call', (response, cb) => {
    cb({})
  })

  // emulate receiving message from queue
  setTimeout(() => { // amqp ready after
    amqpConnection.queue('queue:test.call', {}, (queue) => {
      queue.cb()
    })
  }, 50)
})
