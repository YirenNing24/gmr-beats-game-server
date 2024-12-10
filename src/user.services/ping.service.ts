import ping from 'ping'



class PingService {


    public async assignServer() {
        try {
            const hosts = ['192.168.1.1', 'google.com', 'yahoo.com'];
            hosts.forEach(function(host){
                ping.sys.probe(host, function(isAlive){
                    var msg = isAlive ? 'host ' + host + ' is alive' : 'host ' + host + ' is dead';
                    console.log(msg);
                });
            });



        } catch(error: any) {
          throw error;
        }
    }
}

export default PingService