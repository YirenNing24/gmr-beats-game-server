module.exports = {
  apps: [
    {
      name: "beats-main-server",
      script: "src/index.ts",
      interpreter: "/root/.bun/bin/bun",  // Use the absolute path
      env: {
        NODE_TLS_REJECT_UNAUTHORIZED: "0"
      },
      watch: true
    }
  ]
};
