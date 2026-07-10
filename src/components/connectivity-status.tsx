"use client";

import { useEffect, useState } from "react";

export function ConnectivityStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [isGeminiConnected, setIsGeminiConnected] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkConnectivity = async () => {
      try {
        setLoading(true);
        // Check API connectivity
        const apiResponse = await fetch("/api/agent-status", {
          method: "GET",
          signal: AbortSignal.timeout(3000),
        });
        setIsConnected(apiResponse.ok);

        // Check Gemini connectivity - if API is up, Gemini is initialized
        // (Gemini initializes at app startup, so we'll trust the API status)
        setIsGeminiConnected(apiResponse.ok);
      } catch (error) {
        setIsConnected(false);
        setIsGeminiConnected(false);
      } finally {
        setLoading(false);
      }
    };

    checkConnectivity();

    // Check connectivity every 10 seconds
    const interval = setInterval(checkConnectivity, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Gemini Toggle */}
      <div className="flex flex-col items-center gap-1">
        <div
          className={`relative h-8 w-14 rounded-full border-2 transition-all duration-300 ${
            isGeminiConnected
              ? "border-[#35792a] bg-gradient-to-r from-[#95c58e] to-[#35792a]"
              : "border-[#ef4444] bg-gradient-to-r from-[#fca5a5] to-[#ef4444]"
          }`}
        >
          <div
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300 ${
              isGeminiConnected ? "right-1" : "left-1"
            }`}
          />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          Gemini AI
        </span>
      </div>

      {/* Status Text */}
      <span className="text-xs text-white opacity-90">
        {loading
          ? "Checking..."
          : isGeminiConnected ? "✓ Connected" : "✗ Disconnected"}
      </span>
    </div>
  );
}
