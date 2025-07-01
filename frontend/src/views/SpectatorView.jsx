import React, { useEffect, useRef, useState } from "react";
import "./SpectatorView.css";

export default function SpectatorView() {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  // Player details — example data
  const player = {
    name: "Player One",
    level: 5,
    health: 75,
    score: 12345,
    status: "Alive",
  };

  // Get camera stream
  useEffect(() => {
    let activeStream;

    const enableCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
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

  // Fix for 100vh on mobile
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };

    setVH();
    window.addEventListener("resize", setVH);
    return () => window.removeEventListener("resize", setVH);
  }, []);

  return (
    <div className="spectator-container">
      <h1 className="title">Spectator View</h1>

      {error ? (
        <div className="error-message">{error}</div>
      ) : (
        <div className="video-wrapper">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-video"
          />
          <div className="overlay-info">
            <div className="health-bar-container">
              <div className="health-labels">
                <span>Health</span>
                <span>{player.health}%</span>
              </div>
              <div className="health-bar-track">
                <div
                  className="health-bar-fill"
                  style={{ width: `${player.health}%` }}
                ></div>
              </div>
            </div>

            <div className="player-details">
              <p className="player-name">{player.name}</p>
              <p className="player-level">Level: {player.level}</p>
              <p className="player-score">Score: {player.score}</p>
              <p className="player-status">Status: {player.status}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
