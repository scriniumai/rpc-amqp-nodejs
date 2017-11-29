const { waitForConnect } = require('./amqp-helper')
const {
  parseResponse,
  buildRequest,
  getRequestExchange,
  getRequestQueue,
  getResponseExchange,
  getResponseQueue,
  generateCorrelationId
} = require('lib/rpc/protocol')

const AMQP_NON_PERSISTENT = 1

class RpcClient {
  constructor (connection, {connectionTimeout, requestTimeout} = {}) {
    this.connection = connection

    this.params = {
      connectionTimeout: Number(connectionTimeout || 5000),
      requestTimeout: Number(requestTimeout || 5000)
    }
  }

  /**
   * Calls remote command over rmq
   *  1. Check that connection is ready
   *  2. Declare all needed exchanges and queues
   *  3. Put request to exchange
   *  4. Subscribe to response
   *
   * @param {String} command
   * @param {Object} request
   * @return {Promise}
   */
  call (command, request = {}) {
    return new Promise((resolve, reject) => {
      const correlationId = generateCorrelationId()
      const {connection, params: {connectionTimeout, requestTimeout}} = this

      prepareRabbit(connection, command, correlationId, connectionTimeout)
        .then(([requestExchange, requestQueue, responseExchange, responseQueue]) => {
          // prepare request with service fields
          const requestRaw = buildRequest(request, {
            correlationId,
            command,
            responseQueueName: responseQueue.name
          })

          // set request timeout
          var requestTimer = setTimeout(() => {
            responseQueue.destroy()
            reject(new Error(`rpc-client: Request timeout over ${this.params.requestTimeout}ms; command:${command}, ${correlationId}`))
          }, requestTimeout)

          var consumerTag
          // subscribe to response
          responseQueue.subscribe({ack: true}, (responseRaw, headers, deliveryInfo, messageObject) => {
            clearTimeout(requestTimer)
            messageObject.acknowledge()

            responseQueue.unsubscribe(consumerTag)
            responseQueue.destroy()

            const response = parseResponse(responseRaw)
            if (correlationId !== response.correlationId) {
              return reject(new Error(`rpc-client: Not match correlationIds: EXPECTED: ${correlationId}, RECEIVED: ${response.correlationId}`))
            }
            resolve(response)
          }).addCallback((ok) => {
            consumerTag = ok.consumerTag
            // put request to exchange after it subscribed
            requestExchange.publish('', requestRaw, {deliveryMode: AMQP_NON_PERSISTENT})
          })
        })
        .catch(reject)
    })
  }
}

/**
 * Prepare exchanges and queues according protocol
 *  1. Be sure that connection is ready
 *  2. Declare exchanges and queues and bind it according protocol
 *  3. Return {Array} of exchanges and queues
 *
 * @param {amqp/сonnection} connection
 * @param {String} command
 * @param {String} correlationId
 * @param {Number} connectionTimeout
 * @return {Promise}
 */
function prepareRabbit (connection, command, correlationId, connectionTimeout) {
  return waitForConnect(connection, connectionTimeout)
    .then(connection => {
      return Promise.all([
        getRequestExchange(connection, command),
        getRequestQueue(connection, command),
        getResponseExchange(connection, command),
        getResponseQueue(connection, command, correlationId)
      ])
    })
    .then(([requestExchange, requestQueue, responseExchange, responseQueue]) => {
      requestQueue.bind(requestExchange, '')
      responseQueue.bind(responseExchange, responseQueue.name)

      return [requestExchange, requestQueue, responseExchange, responseQueue]
    })
}

module.exports = RpcClient
