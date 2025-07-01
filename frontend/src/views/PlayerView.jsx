import React, { useRef, useEffect, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";
import "./PlayerView.css";

export default function PlayerView() {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [particles, setParticles] = useState([]);

  const predictionsRef = useRef([]);

  useEffect(() => {
    let model;
    let modelLoaded = false;
    let stream;
    let animationId;

    const canvas = (predictions) => {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      // crosshair
      ctx.strokeStyle = "black";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(canvasRef.current.width / 2, canvasRef.current.height / 2 - 11);
      ctx.lineTo(canvasRef.current.width / 2, canvasRef.current.height / 2 + 11);
      ctx.moveTo(canvasRef.current.width / 2 - 11, canvasRef.current.height / 2);
      ctx.lineTo(canvasRef.current.width / 2 + 11, canvasRef.current.height / 2);
      ctx.stroke();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvasRef.current.width / 2, canvasRef.current.height / 2 - 10);
      ctx.lineTo(canvasRef.current.width / 2, canvasRef.current.height / 2 + 10);
      ctx.moveTo(canvasRef.current.width / 2 - 10, canvasRef.current.height / 2);
      ctx.lineTo(canvasRef.current.width / 2 + 10, canvasRef.current.height / 2);
      ctx.stroke();
      // boxes
      predictions.forEach((pred) => {
        if (pred.class === "person" && pred.score > 0.5) {
          ctx.strokeStyle = "red";
          ctx.lineWidth = 2;
          ctx.strokeRect(...pred.bbox);
          ctx.font = "16px Arial";
          ctx.fillStyle = "red";
          // ctx.fillText(
          //   `${pred.class} (${(pred.score * 100).toFixed(1)}%)`,
          //   pred.bbox[0],
          //   pred.bbox[1] > 20 ? pred.bbox[1] - 5 : 10,
          // );
        }
      });
    };

    const loadModel = async () => {
      model = await cocoSsd.load();
      modelLoaded = true;
      detectFrame();
    };

    const detectFrame = async () => {
      if (videoRef.current && modelLoaded) {
        const predictions = await model.detect(videoRef.current);
        canvas(predictions);
      }
      animationId = requestAnimationFrame(detectFrame);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((mediaStream) => {
        stream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (canvasRef.current && videoRef.current) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
            }
          };
          loadModel();
        }
      });

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);
  const [recoil, setRecoil] = useState(false);

  const handleShoot = () => {
    setRecoil(true);
    setTimeout(() => setRecoil(false), 100); // reset after 100ms

    const id = Date.now();
    setParticles((prev) => [...prev, { id }]);

    // Remove after 400ms
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 400);
  };

  return (
    <div className="player-wrapper" onClick={handleShoot}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="player-video"
      />
      <canvas
        ref={canvasRef}
        className="player-canvas"
      />

      <div className="gun-overlay">
        <img
          src="./gun.png"
          alt="Gun"
          className={`gun-image ${recoil ? "shoot-recoil" : ""}`}
        />
      </div>

      {particles.map((particle) => (
        <div key={particle.id} className="shoot-particle" />
      ))}
    </div>
  );
}
