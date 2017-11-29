function waitForConnect (connection, timeout) {
  return new Promise(function (resolve, reject) {
    if (connection.channels) {
      return resolve(connection)
    }

    var connectionTimer = setTimeout(() => {
      reject(new Error('Connection timeout'))
    }, timeout)

    connection.on('ready', () => {
      clearTimeout(connectionTimer)
      resolve(connection)
    })
  })
}

var exchanges = {}
function exchange (connection, name, params) {
  return new Promise((resolve, reject) => {
    if (exchanges.hasOwnProperty(name)) {
      return resolve(exchanges[name])
    }

    connection.exchange(name, params, (exchange) => {
      exchanges[name] = exchange
      return resolve(exchange)
    })
  })
}

var queues = {}
function queue (connection, name, params) {
  return new Promise((resolve, reject) => {
    if (queues.hasOwnProperty(name)) {
      return resolve(queues[name])
    }

    connection.queue(name, params, (queue) => {
      queues[name] = queue
      return resolve(queue)
    })
  })
}

function clearCache () {
  queues = {}
  exchanges = {}
}

module.exports = {
  waitForConnect,
  exchange,
  queue,
  clearCache
}
