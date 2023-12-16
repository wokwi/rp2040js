import { createServer, Socket } from 'net';
import { GDBConnection } from './gdb-connection.js';
import { GDBServer } from './gdb-server.js';
import { IGDBTarget } from './gdb-target.js';

export class GDBTCPServer extends GDBServer {
  private socketServer = createServer();

  constructor(
    target: IGDBTarget,
    readonly port: number = 3333,
  ) {
    super(target);
    this.socketServer.listen(port);
    this.socketServer.on('connection', (socket) => this.handleConnection(socket));
  }

  handleConnection(socket: Socket) {
    this.info('GDB connected');
    socket.setNoDelay(true);

    const connection = new GDBConnection(this, (data) => {
      socket.write(data);
    });

    socket.on('data', (data) => {
      connection.feedData(data.toString('utf-8'));
    });

    socket.on('error', (err) => {
      this.removeConnection(connection);
      this.error(`GDB socket error ${err}`);
    });

    socket.on('close', () => {
      this.removeConnection(connection);
      this.info('GDB disconnected');
    });
  }
}
