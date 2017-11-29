const CORRELATION_ID_BYTES = 10

const HTTP_STATUS_SUCCESS = 200
const HTTP_STATUS_ERROR = 502

const crypto = require('crypto')
const { exchange, queue } = require('./amqp-helper')

function buildRequest (request, extraParams = {}) {
  Object.assign(request, extraParams)
  return JSON.stringify(request)
}

function parseRequest (requestObject) {
  return JSON.parse(requestObject.data)
}

function parseResponse (responseRaw) {
  if (responseRaw.data.constructor === Buffer) {
    responseRaw = JSON.parse(responseRaw.data)
  }

  const { correlationId, timings, data: dataJson } = responseRaw
  const { status, data } = JSON.parse(dataJson)
  return {
    status: Number(status),
    data,
    correlationId,
    timings
  }
}

function buildResponse (data, {correlationId, timings} = {}) {
  return {
    data: JSON.stringify(data),
    correlationId,
    timings
  }
}

function getRequestExchange (connection, command) {
  const name = `queue:${command}`
  const params = {
    type: 'fanout',
    durable: false,
    autoDelete: false,
    internal: false
  }
  return exchange(connection, name, params)
}

function getRequestQueue (connection, command) {
  const name = `queue:${command}`
  const params = {
    durable: true,
    autoDelete: false,
    closeChannelOnUnsubscribe: true
  }
  return queue(connection, name, params)
}

function getResponseExchange (connection, command) {
  const name = `queue:${command}Response`
  const params = {
    type: 'topic',
    durable: false,
    autoDelete: false,
    internal: false
  }
  return exchange(connection, name, params)
}

function getResponseQueue (connection, command, correlationId) {
  var name
  if (!correlationId) {
    name = `queue:${command}Response.${correlationId}`
  } else {
    name = `rpc.queue:${command}Response.${correlationId}`
  }

  const params = {
    autoDelete: false,
    closeChannelOnUnsubscribe: true,
    exclusive: true
  }
  return queue(connection, name, params)
}

function generateCorrelationId () {
  return crypto.randomBytes(CORRELATION_ID_BYTES).toString('hex')
}

/**
 * Format success response
 * @param data
 * @param status
 * @return {{status: Number, data: Object}}
 */
function formatSuccess (data = {}, status = HTTP_STATUS_SUCCESS) {
  return {status, data}
}

/**
 * Format error response
 * @param message
 * @param details
 * @param data
 * @param status
 * @return {{status: Number, data: Object}}
 */
function formatError (message = 'Unexpected error', details = {}, data = {}, status = HTTP_STATUS_ERROR) {
  return {
    status,
    data: Object.assign(data, {details, message})
  }
}

module.exports = {
  generateCorrelationId,

  formatSuccess,
  formatError,

  buildRequest,
  parseRequest,
  buildResponse,
  parseResponse,

  getRequestExchange,
  getRequestQueue,
  getResponseExchange,
  getResponseQueue
}

