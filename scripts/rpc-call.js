#!/usr/bin/nodejs

const config = require('config.json')

const amqp = require('amqp')
const RpcClient = require('lib/rpc/client')

const [,, command, request] = process.argv

console.log('Script started')

const connection = amqp.createConnection(config.amqp, {reconnectBackoffTime: 5000})
connection.on('error', console.error.bind(console))

const rpcClient = new RpcClient(connection)

rpcClient.call(command, JSON.parse(request))
  .then(logResponse)
  .catch(logError)
  .then(process.exit)

function logResponse (response) {
  console.log('Response received:')
  console.log(' status:', response.status)
  console.log(' data:', response.data)
}

function logError (err) {
  console.error(err)
}
