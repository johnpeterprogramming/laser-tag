import React, { useRef, useEffect, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as bodyPix from "@tensorflow-models/body-pix";
import "@tensorflow/tfjs";
import "./PlayerView.css";

export default function PlayerView() {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [particles, setParticles] = useState([]);
  const [bodyPixNet, setBodyPixNet] = useState(null);
  const predictionsRef = useRef([]);

  useEffect(() => {
    let model;
    let bodyPixModel;
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
      const bpNet = await bodyPix.load();
      modelLoaded = true;
      setBodyPixNet(bpNet);
      detectFrame();
    };

    const detectFrame = async () => {
      if (videoRef.current && modelLoaded) {
        const predictions = await model.detect(videoRef.current);
        predictionsRef.current = predictions;
        if (canvasRef.current) {
          canvas(predictions);
        }
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

  function getTargetPrediction(predictions) {
    const cx = canvasRef.current.width / 2;
    const cy = canvasRef.current.height / 2;
    const results = [];
    for (const pred of predictions) {
      if (pred.class === "person" && pred.score > 0.5) {
        const [x, y, w, h] = pred.bbox;
        // Check if crosshair (cx, cy) is within bbox
        if (cx >= x && cx <= x + w && cy >= y && cy <= y + h) {
          results.push(pred);
        }
      }
    }
    return results
  }

  async function segmentShirtColor(video, bbox) {
    if (!bodyPixNet || !video || !bbox) return null;

    const SMALL_WIDTH = 160;
    const SMALL_HEIGHT = 120;
    
    const [x, y, width, height] = bbox;
    
    // Define crop margins (adjust these values as needed)
    const CROP_MARGIN_X = width * 0.1;  // Crop 10% from left/right edges
    const CROP_MARGIN_Y = height * 0.1; // Crop 10% from top/bottom edges
    
    // Calculate cropped region
    const croppedX = x + CROP_MARGIN_X;
    const croppedY = y + CROP_MARGIN_Y;
    const croppedWidth = width - (2 * CROP_MARGIN_X);
    const croppedHeight = height - (2 * CROP_MARGIN_Y);
    
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = SMALL_WIDTH;
    tempCanvas.height = SMALL_HEIGHT;
    const tempCtx = tempCanvas.getContext("2d");
    
    // Draw the cropped bounding box region, scaled down
    tempCtx.drawImage(
      video, // source
      croppedX, croppedY, croppedWidth, croppedHeight, // cropped source rect
      0, 0, SMALL_WIDTH, SMALL_HEIGHT                   // destination rect
    );

    // Rest of your segmentation code...
    const segmentation = await bodyPixNet.segmentPersonParts(tempCanvas, {
      internalResolution: "low",
      segmentationThreshold: 0.7,
    });

    // Process results...
  }

  

  const handleShoot = async () => {
    setRecoil(true);
    const targets = getTargetPrediction(predictionsRef.current);
    if (targets.length > 0) {
      for (const target of targets) {
        console.log("Hit target:", target);
        const color = await segmentShirtColor(videoRef.current, target.bbox);
        // Here you can handle the hit logic, e.g., send a hit event to the server
      }
    }
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
