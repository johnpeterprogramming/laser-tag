import React, { useEffect, useRef, useState } from "react";

export default function SpectatorView() {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activeStream;

    const enableCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError("Unable to access camera.");
      }
    };

    enableCamera();

    Clean up on component unmount
    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold mb-4">Spectator View</h1>
      <p className="mb-6 text-lg">Live camera feed displayed below:</p>

      {error ? (
        <div className="bg-red-600 text-white px-4 py-2 rounded">{error}</div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="rounded-lg shadow-xl max-w-full w-[640px] h-[480px] border-4 border-white"
        />
      )}
    </div>
  );
}
