const express = require('express');
const net = require('net');
const http = require('http');
const { WebSocket, createWebSocketStream } = require('ws');
const { TextDecoder } = require('util');
const fs = require('fs');
const path = require('path');

const logFile = 'ws.log';

const logStream = fs.createWriteStream(logFile, { flags: 'a' });
console.log = (...args) => {
  logStream.write(`${new Date().toISOString()} [INFO] ${args.join(' ')}\n`);
};
console.error = (...args) => {
  logStream.write(`${new Date().toISOString()} [ERROR] ${args.join(' ')}\n`);
};

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const uuid = (process.env.UUID || 'd342d11e-d424-4583-b36e-524ab1f0afa4').replace(/-/g, "");
const port = process.env.PORT || 3000;

wss.on('connection', ws => {
  console.log("on connection");
  ws.once('message', msg => {
    const [VERSION] = msg;
    const id = msg.slice(1, 17);
    if (!id.every((v, i) => v == parseInt(uuid.substr(i * 2, 2), 16))) return;
    let i = msg.slice(17, 18).readUInt8() + 19;
    const port = msg.slice(i, i += 2).readUInt16BE(0);
    const ATYP = msg.slice(i, i += 1).readUInt8();
    const host = ATYP == 1 ? msg.slice(i, i += 4).join('.') : //IPV4
      (ATYP == 2 ? new TextDecoder().decode(msg.slice(i + 1, i += 1 + msg.slice(i, i + 1).readUInt8())) : //domain
        (ATYP == 3 ? msg.slice(i, i += 16).reduce((s, b, i, a) => (i % 2 ? s.concat(a.slice(i - 1, i + 1)) : s), []).map(b => b.readUInt16BE(0).toString(16)).join(':') : '')); //ipv6

    console.log('conn:', host, port);
    ws.send(new Uint8Array([VERSION, 0]));
    const duplex = createWebSocketStream(ws);
    net.connect({ host, port }, function () {
      this.write(msg.slice(i));
      duplex.on('error', console.error.bind(null, 'E1:')).pipe(this).on('error', console.error.bind(null, 'E2:')).pipe(duplex);
    }).on('error', console.error.bind(null, 'Conn-Err:', { host, port }));
  }).on('error', console.error.bind(null, 'EE:'));
});

app.get('/', (req, res) => {
  const indexPath = path.join('.', 'index.html');

  fs.readFile(indexPath, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else {
      res.status(200).send(data);
    }
  });
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
