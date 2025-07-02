import React, { useRef, useEffect, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as bodyPix from "@tensorflow-models/body-pix";
import "@tensorflow/tfjs";
import "./PlayerView.css";

export default function PlayerView() {
  const videoRef = useRef();
  const canvasRef = useRef();
  const tempCanvasRef = useRef();
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
        }
      });
    };

    const loadModel = async () => {
      model = await cocoSsd.load();
      const bpNet = await bodyPix.load();
      bodyPixModel = bpNet;
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

  const SMALL_WIDTH = 350;
  const SMALL_HEIGHT = 350;
  
  const [x, y, width, height] = bbox;
  
  // Define crop margins (adjust these values as needed)
  const CROP_MARGIN_X = width * 0.2;  // Crop 20% from left/right edges
  const CROP_MARGIN_Y = height * 0.2; // Crop 20% from top/bottom edges
  
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
    segmentationThreshold: 0.2,
    scoreThreshold: 0.2,
    segmentBodyParts: true,
  });

  // Process results...
  console.log("Segmentation result:", segmentation);
  // Parts 12, 13 = torso
  const { data: partMap } = segmentation;
  console.log("Part map:", partMap);
  const uniqueParts = [...new Set(partMap)];
  console.log("Detected body parts:", uniqueParts);
  console.log("Looking for torso parts: 12 (torso_front), 13 (torso_back)");

  const imgData = tempCtx.getImageData(0, 0, SMALL_WIDTH, SMALL_HEIGHT);
  
  // Use Map to count color frequencies
  const colorFrequency = new Map();
  
  for (let i = 0; i < partMap.length; i++) {
    if (partMap[i] === 12 || partMap[i] === 13 || partMap[i] === 2 || partMap[i] === 3 || partMap[i] === 4 || partMap[i] === 5) {
      // Get pixel coordinates
      const segX = i % segmentation.width;
      const segY = Math.floor(i / segmentation.width);
      
      // Scale to canvas coordinates
      const canvasX = Math.floor((segX / segmentation.width) * SMALL_WIDTH);
      const canvasY = Math.floor((segY / segmentation.height) * SMALL_HEIGHT);
      
      const pixelIndex = (canvasY * SMALL_WIDTH + canvasX) * 4;
      
      if (pixelIndex < imgData.data.length) {
        const r = imgData.data[pixelIndex];
        const g = imgData.data[pixelIndex + 1];
        const b = imgData.data[pixelIndex + 2];
        
        // Quantize colors to reduce noise (group similar colors together)
        const quantizedR = Math.round(r / 16) * 16; // Reduce to 16 levels
        const quantizedG = Math.round(g / 16) * 16;
        const quantizedB = Math.round(b / 16) * 16;
        
        const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;
        
        if (colorFrequency.has(colorKey)) {
          colorFrequency.set(colorKey, colorFrequency.get(colorKey) + 1);
        } else {
          colorFrequency.set(colorKey, 1);
        }
      }
    }
  }
  
  if (colorFrequency.size > 0) {
    // Find the mode (most frequent color)
    let maxCount = 0;
    let modeColor = null;
    
    for (const [colorKey, count] of colorFrequency.entries()) {
      if (count > maxCount) {
        maxCount = count;
        const [r, g, b] = colorKey.split(',').map(Number);
        modeColor = { r, g, b };
      }
    }
    
    console.log(`Mode color found with ${maxCount} occurrences:`, modeColor);
    console.log(`Total unique colors: ${colorFrequency.size}`);
    
    return modeColor;
  } else {
    console.log("No torso pixels found");
    return null;
  }
}

  

  const handleShoot = async () => {
    setRecoil(true);
    const targets = getTargetPrediction(predictionsRef.current);
    if (targets.length > 0) {
      for (const target of targets) {
        console.log("Hit target:", target);
        const color = await segmentShirtColor(videoRef.current, target.bbox);
        console.log("Segmented shirt color:", color);
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
