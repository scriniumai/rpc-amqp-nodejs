# Rpc client/server based on RabbitMQ (Nodejs implementation)

#### How to use:

Server:
```js

const RpcServer = require('amqp-rpc/server')

const amqp = require('amqp').createConnection({
    host: "127.0.0.1"
    port: "5672",
    login: "user",
    password: "user"
})
const rpcServer = new RpcServer(amqpConnection)

rpcServer.on('user.get', (req, cb) => {
    let user = { ... }

    cb({
        status: 200,
        data: {
            user
        }
    })
})
```

Client:
```js

const RpcClient = require('amqp-rpc/client')
const amqp = require('amqp').createConnection({ ... })
const rpcClient = new RpcClient(amqpConnection)

try {
    const { status, data } = await rpcClient.call('user.get', {id: 123});
    const user = data.user
} catch (err) {
    //handle error
}
```
