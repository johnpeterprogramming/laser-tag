import React, { useState, useEffect } from 'react';

// Removed: interface ApiResponse, as this is a JavaScript file.

export default function PlayerView() {
  // useState hooks no longer have explicit type annotations.
  // JavaScript infers types based on initial values or 'any' if not explicitly defined.
  const [data, setData] = useState(null); // data can be null or the fetched object
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // error can be null or a string

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Make the API call to your localhost endpoint
        const response = await fetch('http://localhost:5000/api');

        // Check if the response was successful
        if (!response.ok) {
          // If not successful, throw an error with the status
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Parse the JSON response. Type is implicitly 'any' in JavaScript.
        const result = await response.json();
        setData(result); // Set the fetched data
      } catch (err) { // err is implicitly 'any' in JavaScript
        // Catch any errors during the fetch operation
        setError(err.message); // Set the error message
      } finally {
        // Always set loading to false after the fetch attempt
        setLoading(false);
      }
    };

    fetchData(); // Call the fetch function when the component mounts
  }, []); // Empty dependency array means this effect runs once after the initial render

  return (
    <>
      {/* Player View specific content */}
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', color: '#1e90ff' }}>Player View</h1>
        <p>This is where players will scan and interact with the game.</p>
      </div>

      {/* API Call Test section */}
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
            API Call Test
          </h1>

          {loading && (
            <p className="text-center text-blue-500 text-lg">Loading data from API...</p>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">Error:</strong>
              <span className="block sm:inline ml-2">{error}</span>
              <p className="mt-2 text-sm">
                Please ensure your backend server is running at `http://localhost:5000/api` and accessible.
              </p>
            </div>
          )}

          {data && (
            <div className="mt-4">
              <h2 className="text-xl font-semibold text-gray-700 mb-2">API Response:</h2>
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                <p className="text-gray-600">
                  {/* Access properties of data directly. In JavaScript, you rely on runtime checks or documentation */}
                  <span className="font-medium">Message:</span> {data.message}
                </p>
                {data.data && (
                  <div className="mt-2">
                    <p className="font-medium text-gray-600">Additional Data:</p>
                    <pre className="bg-gray-200 p-2 rounded text-sm overflow-x-auto">
                      {JSON.stringify(data.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
              <p className="mt-4 text-center text-green-600 text-sm">
                Data fetched successfully!
              </p>
            </div>
          )}

          {!loading && !data && !error && (
            <p className="text-center text-gray-500 text-lg">
              No data received. Check your API server.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
