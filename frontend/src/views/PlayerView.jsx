import React, { useRef, useEffect } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";
import "./PlayerView.css";

export default function PlayerView() {
  const videoRef = useRef();
  const canvasRef = useRef();

  useEffect(() => {
    let model;
    let modelLoaded = false;
    let stream;
    let animationId;

    const drawBoxes = (predictions) => {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      predictions.forEach((pred) => {
        if (pred.class === "person" && pred.score > 0.5) {
          ctx.strokeStyle = "red";
          ctx.lineWidth = 2;
          ctx.strokeRect(...pred.bbox);
          ctx.font = "16px Arial";
          ctx.fillStyle = "red";
          ctx.fillText(
            `${pred.class} (${(pred.score * 100).toFixed(1)}%)`,
            pred.bbox[0],
            pred.bbox[1] > 20 ? pred.bbox[1] - 5 : 10,
          );
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
        drawBoxes(predictions);
      }
      animationId = requestAnimationFrame(detectFrame);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((mediaStream) => {
        stream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          loadModel();
        }
      });

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleShoot = () => {
    console.log("Shoot!");
    // ADD LOGIC HERE
  };

  return (
    <div className="player-wrapper">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        width={640}
        height={480}
        className="player-video"
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="player-canvas"
      />
      <button className="shoot-button" onClick={handleShoot}>
        Shoot
      </button>
    </div>
  );
}
