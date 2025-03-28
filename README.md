# Mojo Token Rewards Cloudflare Worker

A Cloudflare Worker for minting Mojo tokens based on user scores.

## Features

- Endpoint for minting Mojo tokens to user addresses
- Secure handling of private keys using Cloudflare environment variables
- CORS support for cross-origin requests

## Setup and Deployment

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Add your private key to a `.dev.vars` file for local testing (do not commit this file):
   ```
   PRIVATE_KEY=your-private-key-here
   ```
4. Run the worker locally:
   ```bash
   npx wrangler dev
   ```

### Deployment

1. Login to Cloudflare:
   ```bash
   npx wrangler login
   ```

2. Add your private key as a secret:
   ```bash
   npx wrangler secret put PRIVATE_KEY
   ```

3. Deploy the worker:
   ```bash
   npx wrangler deploy
   ```

## API Usage

### Health Check
```
GET /
```

Returns:
```json
{
  "status": "online",
  "message": "Mojo Token Rewards API is running"
}
```

### Mint Tokens
```
POST /
```

Request body:
```json
{
  "address": "0x...",
  "mojoScore": 10
}
```

Response:
```json
{
  "success": true,
  "txHash": "0x...",
  "blockNumber": 12345
}
```

## Security Considerations

- Never commit your private key to the repository
- Use environment variables or Cloudflare secrets for sensitive information
- Monitor your token contract for any unusual activity 