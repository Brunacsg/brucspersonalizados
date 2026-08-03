const { app } = require('./server');

const port = Number(process.env.PORT) || 3001;

function listenOnPort(candidatePort) {
  const server = app.listen(candidatePort, '0.0.0.0', () => {
    console.log(`Preview server running at http://localhost:${candidatePort}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && candidatePort < 8100) {
      console.warn(`Port ${candidatePort} is busy, trying ${candidatePort + 1}...`);
      server.close(() => listenOnPort(candidatePort + 1));
      return;
    }
    throw err;
  });
}

listenOnPort(port);
