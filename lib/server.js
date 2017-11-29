const { waitForConnect } = require('./amqp-helper')
const {
  parseRequest,
  buildResponse,
  getRequestExchange,
  getRequestQueue,
  getResponseExchange
} = require('lib/rpc/protocol')

class RpcServer {
  constructor (connection, {connectionTimeout} = {}) {
    this.connection = connection

    this.params = {
      connectionTimeout: Number(connectionTimeout || 5000)
    }
  }

  on (command, handler) {
    const { connection, params: {connectionTimeout} } = this

    prepareRabbit(connection, command, connectionTimeout)
      .then(([requestExchange, requestQueue]) => {
        return requestQueue.subscribe({ack: true}, getSubscribeCallback(connection, command, handler))
      })
      .catch((err) => {
        throw err
      })
  }
}

function getSubscribeCallback (connection, command, handler) {
  return (requestRaw, headers, deliveryInfo, messageObject) => {
    const request = parseRequest(requestRaw)

    handler(request, (response) => {
      getResponseExchange(connection, command)
        .then(exchange => {
          exchange.publish(request.responseQueueName, buildResponse(response, request))
          messageObject.acknowledge()
        })
        .catch(err => {
          throw err
        })
    })
  }
}

function prepareRabbit (connection, command, connectionTimeout) {
  return waitForConnect(connection, connectionTimeout)
    .then(connection => {
      return Promise.all([
        getRequestExchange(connection, command),
        getRequestQueue(connection, command)
      ])
    })
    .then(([requestExchange, requestQueue]) => {
      requestQueue.bind(requestExchange, '')
      return [requestExchange, requestQueue]
    })
}

module.exports = RpcServer
