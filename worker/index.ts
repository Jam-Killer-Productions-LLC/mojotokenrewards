import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { ethers } from "ethers";

const MOJO_TOKEN_CONTRACT_ADDRESS = "0xf9e7D3cd71Ee60C7A3A64Fa7Fcb81e610Ce1daA5";

export interface Env {
  PRIVATE_KEY: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

function handleCORS(): Response {
  return new Response(null, { 
    status: 204,
    headers: corsHeaders
  });
}

async function mintMojoTokens(userAddress: string, mojoScore: number, privateKey: string) {
  const sdk = ThirdwebSDK.fromPrivateKey(
    privateKey,
    "optimism",
    { clientId: "e24d90c806dc62cef0745af3ddd76314" }
  );

  const mojoContract = await sdk.getContract(MOJO_TOKEN_CONTRACT_ADDRESS);
  const tokenAmount = ethers.utils.parseUnits(mojoScore.toString(), 18);
  
  const tx = await mojoContract.erc20.mintTo(userAddress, tokenAmount);
  
  return { txHash: tx.receipt.transactionHash };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const responseHeaders = {
      ...corsHeaders,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
    };

    if (request.method === "OPTIONS") {
      return handleCORS();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (!env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY is not set");
      }

      if (request.method === "GET" && path === '/') {
        return new Response(JSON.stringify({
          status: "online",
          message: "Mojo Token Rewards API"
        }), { 
          status: 200, 
          headers: responseHeaders
        });
      }
      
      if (request.method === "POST" && path === '/mint') {
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ 
            error: "Invalid JSON"
          }), { 
            status: 400, 
            headers: responseHeaders 
          });
        }

        const { address, mojoScore } = body;
        
        if (!address) {
          return new Response(JSON.stringify({ 
            error: "Missing address"
          }), { 
            status: 400, 
            headers: responseHeaders 
          });
        }

        if (!mojoScore) {
          return new Response(JSON.stringify({ 
            error: "Missing mojoScore"
          }), { 
            status: 400, 
            headers: responseHeaders 
          });
        }

        if (!ethers.utils.isAddress(address)) {
          return new Response(JSON.stringify({ 
            error: "Invalid Ethereum address"
          }), { 
            status: 400, 
            headers: responseHeaders 
          });
        }

        const scoreNumber = Number(mojoScore);
        if (isNaN(scoreNumber) || scoreNumber <= 0) {
          return new Response(JSON.stringify({ 
            error: "mojoScore must be a positive number"
          }), { 
            status: 400, 
            headers: responseHeaders 
          });
        }

        const result = await mintMojoTokens(address, scoreNumber, env.PRIVATE_KEY);
        
        return new Response(
          JSON.stringify({ txHash: result.txHash }),
          { headers: responseHeaders }
        );
      }
      
      return new Response(JSON.stringify({ 
        error: "Endpoint not found",
        availableEndpoints: ["/", "/mint"]
      }), { 
        status: 404, 
        headers: responseHeaders 
      });
    } catch (error) {
      let errorMessage = "Internal Server Error";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return new Response(
        JSON.stringify({ error: errorMessage }), 
        { status: 500, headers: responseHeaders }
      );
    }
  }
};
