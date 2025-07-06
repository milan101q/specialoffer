import React from "react";

export default function TestPage() {
  return (
    <div className="p-8 bg-blue-100 min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-4">Test Page is Working</h1>
      <p className="mb-4">This is a simple test page to verify that React routing is working correctly.</p>
      <a href="/" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        Go to Home
      </a>
    </div>
  );
}