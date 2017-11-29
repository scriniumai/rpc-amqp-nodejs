var test = require('tape')
const { parseResponse, buildRequest } = require('lib/rpc/protocol')

test('test parseResponse', t => {
  const responseRaw = {
    data: JSON.stringify({
      status: '200',
      data: { responseParam: 222 }
    }),
    correlationId: '123',
    timings: []
  }

  t.deepEqual(parseResponse(responseRaw), {
    status: 200,
    data: { responseParam: 222 },
    correlationId: '123',
    timings: []
  })
  t.end()
})

// Response from php library differs with node-js amqp library
test('test parseResponse for php response', t => {
  const responseRaw = {
    data: new Buffer(
      JSON.stringify({
        data: JSON.stringify({
          status: '200',
          data: {responseParam: 222}
        }),
        correlationId: '123',
        timings: []
      })
    )
  }

  t.deepEqual(parseResponse(responseRaw), {
    status: 200,
    data: { responseParam: 222 },
    correlationId: '123',
    timings: []
  })
  t.end()
})

test('test buildRequest', t => {
  const request = {
    param: 'value'
  }

  const requestRaw = buildRequest(request, {
    correlationId: '123',
    command: 'test.call',
    responseQueueName: 'queue-name'
  })

  t.deepEqual(requestRaw, JSON.stringify({
    param: 'value',
    correlationId: '123',
    command: 'test.call',
    responseQueueName: 'queue-name'
  }))
  t.end()
})
