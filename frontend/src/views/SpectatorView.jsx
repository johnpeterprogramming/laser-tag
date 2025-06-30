import React, { useEffect, useRef, useState } from "react";

export default function SpectatorView() {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activeStream;

    const enableCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }, // or "user"
        });
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError("Unable to access camera. Please enable it in your browser.");
      }
    };

    enableCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <h1 className="text-3xl font-bold mb-4">Spectator View</h1>
      {error ? (
        <div className="bg-red-600 text-white px-4 py-2 rounded">{error}</div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="rounded-lg shadow-lg w-full max-w-md aspect-video"
        />
      )}
    </div>
  );
}
