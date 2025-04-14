import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { ethers } from "ethers";

interface ServiceBinding {
  fetch(request: Request): Promise<Response>;
}

const MOJO_TOKEN_CONTRACT_ADDRESS = "0xf9e7D3cd71Ee60C7A3A64Fa7Fcb81e610Ce1daA5";

export interface Env {
  PRIVATE_KEY: string;
  metaupload: ServiceBinding;
  dontKillTheJammer: ServiceBinding;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-Api-Key, X-Auth-Token, Origin, Accept, Access-Control-Allow-Headers",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json"
};

function handleCORS(): Response {
  return new Response(null, { 
    status: 204,
    headers: corsHeaders
  });
}

async function mintMojoTokens(userAddress: string, mojoScore: number, privateKey: string) {
  try {
    const sdk = ThirdwebSDK.fromPrivateKey(
      privateKey,
      "optimism",
      {
        clientId: "e24d90c806dc62cef0745af3ddd76314",
      }
    );

    const mojoContract = await sdk.getContract(MOJO_TOKEN_CONTRACT_ADDRESS);
    const tokenAmount = ethers.utils.parseUnits(mojoScore.toString(), 18);
    
    const tx = await mojoContract.erc20.mintTo(userAddress, tokenAmount);
    
    return {
      txHash: tx.receipt.transactionHash
    };
  } catch (error) {
    console.error("Minting error:", error);
    let errorMessage = "Failed to mint tokens";
    if (error instanceof Error) {
      errorMessage = `Failed to mint tokens: ${error.message}`;
      if ((error as any).reason) {
        errorMessage += ` (Reason: ${(error as any).reason})`;
      }
    }
    throw new Error(errorMessage);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const responseHeaders = {
      ...corsHeaders,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    };

    if (request.method === "OPTIONS") {
      return handleCORS();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (!env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY environment variable is not set");
      }

      if (path.startsWith('/metaupload')) {
        const newRequest = new Request(
          request.url.replace('/metaupload', ''),
          request
        );
        return env.metaupload.fetch(newRequest);
      }
      
      if (path.startsWith('/jammer')) {
        const newRequest = new Request(
          request.url.replace('/jammer', ''),
          request
        );
        return env.dontKillTheJammer.fetch(newRequest);
      }

      if (request.method === "GET" && path === '/') {
        return new Response(JSON.stringify({
          status: "online",
          message: "Mojo Token Rewards API is running",
          version: "1.0.0"
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
            error: "Invalid JSON in request body" 
          }), { 
            status: 400, 
            headers: responseHeaders 
          });
        }

        const { address, mojoScore } = body;
        
        if (!address) {
          return new Response(JSON.stringify({ error: "Missing address parameter" }), { 
            status: 400,
            headers: responseHeaders 
          });
        }

        if (!mojoScore) {
          return new Response(JSON.stringify({ error: "Missing mojoScore parameter" }), { 
            status: 400,
            headers: responseHeaders 
          });
        }

        if (!ethers.utils.isAddress(address)) {
          return new Response(JSON.stringify({ error: "Invalid Ethereum address format" }), { 
            status: 400,
            headers: responseHeaders 
          });
        }

        const scoreNumber = Number(mojoScore);
        if (isNaN(scoreNumber) || scoreNumber <= 0) {
          return new Response(JSON.stringify({ error: "mojoScore must be a positive number" }), { 
            status: 400,
            headers: responseHeaders 
          });
        }

        const result = await mintMojoTokens(address, scoreNumber, env.PRIVATE_KEY);
        
        return new Response(
          JSON.stringify({ 
            txHash: result.txHash
          }),
          { headers: responseHeaders }
        );
      }
      
      return new Response(JSON.stringify({ 
        error: "Method not allowed or endpoint not found",
        availableEndpoints: ["/", "/mint", "/metaupload/*", "/jammer/*"] 
      }), { 
        status: 404, 
        headers: responseHeaders 
      });
    } catch (error) {
      console.error("Worker error:", error);
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
