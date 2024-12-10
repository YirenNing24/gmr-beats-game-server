import ping from 'ping';

// Function to check latency to a given host (server)
async function checkICMPLatency(host: string) {
    try {
        console.log(`Pinging to ${host}...`);
        const res: ping.PingResponse = await ping.promise.probe(host, { 

            min_reply: 100, // Minimum number of replies to wait for
            extra: ['-i', '0.1'] // Interval between pings (0.1s) to simulate load
        });
        
        return {
            latency: res.avg, // Average latency in milliseconds
            packetLoss: res.packetLoss, // Packet loss percentage
            stddev: res.stddev // Jitter (variance in latency)
        };
    } catch (error: any) {
        console.error(`Error pinging ${host}:`, error.message);
        return { latency: Infinity, packetLoss: 100, jitter: Infinity }; // Return high values on error
    }
}

// Function to measure latency from a given client IP to the servers
async function measureICMPLatencies() {
    const servers = [
        { name: 'Japan', host: 'jp-game.gmetarave.asia' },
        { name: 'Vietnam', host: 'vn-game.gmetarave.asia' },
        { name: 'Singapore', host: 'sg.gmetarave.asia' }
    ];

    // Run ping tests to both servers
    const results = await Promise.all(
        servers.map(async (server) => {
            const { latency, packetLoss, stddev } = await checkICMPLatency(server.host);
            return { name: server.name, latency, packetLoss, stddev };
        })
    );

    // Log latency results
    console.log('Latency Results:', results);

    // Find the server with the lowest latency, considering also packet loss and jitter
    const bestServer = results.reduce((best, current) => {
        // Choose server with lowest latency and acceptable packet loss & jitter
        if (current.latency < best.latency && current.packetLoss < best.packetLoss && current?.stddev < best?.stddev) {
            return current;
        }
        return best;
    });

    console.log('Best server based on latency, packet loss, and jitter:', bestServer.name);
}

// Call the function to test latency from a given client
measureICMPLatencies();
