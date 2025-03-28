import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { ethers } from "ethers";

// Define service binding interface
interface ServiceBinding {
  fetch(request: Request): Promise<Response>;
}

// Contract address for Mojo token
const MOJO_TOKEN_CONTRACT_ADDRESS = "0xf9e7D3cd71Ee60C7A3A64Fa7Fcb81e610Ce1daA5";

export interface Env {
  PRIVATE_KEY: string;
  // Service bindings
  metaupload: ServiceBinding;
  dontKillTheJammer: ServiceBinding;
}

// CORS headers
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

// Function to mint Mojo tokens to the specified address
async function mintMojoTokens(userAddress: string, mojoScore: number, privateKey: string) {
  try {
    // Initialize SDK with private key on Optimism network
    const sdk = ThirdwebSDK.fromPrivateKey(
      privateKey,
      "optimism",
      {
        clientId: "e24d90c806dc62cef0745af3ddd76314",
      }
    );

    // Get the token contract
    const mojoContract = await sdk.getContract(MOJO_TOKEN_CONTRACT_ADDRESS);
    
    // Convert the mojoScore to the proper token amount with 18 decimals
    const tokenAmount = ethers.utils.parseUnits(mojoScore.toString(), 18);
    
    // Call the mintTo function
    const tx = await mojoContract.call("mintTo", [userAddress, tokenAmount.toString()]);
    
    return {
      transactionHash: tx.receipt.transactionHash,
      blockNumber: tx.receipt.blockNumber
    };
  } catch (error) {
    // Enhance error with more details for debugging
    console.error("Error minting tokens:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to mint tokens: ${error.message}`);
    }
    throw new Error("Unknown error occurred while minting tokens");
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Add security headers
    const responseHeaders = {
      ...corsHeaders,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    };

    // CORS handling
    if (request.method === "OPTIONS") {
      return handleCORS();
    }

    // Extract the URL path
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Validate that PRIVATE_KEY is set
      if (!env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY environment variable is not set");
      }

      // Forward requests to service bindings if path matches
      if (path.startsWith('/metaupload')) {
        // Clone the request and modify URL to remove the path prefix
        const newRequest = new Request(
          request.url.replace('/metaupload', ''),
          request
        );
        return env.metaupload.fetch(newRequest);
      }
      
      if (path.startsWith('/jammer')) {
        // Clone the request and modify URL to remove the path prefix
        const newRequest = new Request(
          request.url.replace('/jammer', ''),
          request
        );
        return env.dontKillTheJammer.fetch(newRequest);
      }

      // Handle main worker endpoints
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
        // Parse JSON safely
        let body;
        try {
          body = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ 
            error: "Invalid JSON in request body" 
          }), { 
            status: 400, 
            headers: responseHeaders 
          });
        }

        // Validate input data
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

        // Validate address format
        if (!ethers.utils.isAddress(address)) {
          return new Response(JSON.stringify({ error: "Invalid Ethereum address format" }), { 
            status: 400,
            headers: responseHeaders 
          });
        }

        // Validate score is a number
        const scoreNumber = Number(mojoScore);
        if (isNaN(scoreNumber) || scoreNumber <= 0) {
          return new Response(JSON.stringify({ error: "mojoScore must be a positive number" }), { 
            status: 400,
            headers: responseHeaders 
          });
        }

        // Mint the tokens
        const result = await mintMojoTokens(address, scoreNumber, env.PRIVATE_KEY);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            txHash: result.transactionHash,
            blockNumber: result.blockNumber
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
      
      // Format error message
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