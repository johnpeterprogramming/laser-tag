import React, { useRef, useEffect } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

export default function PlayerView() {

  const videoRef = useRef();
  const canvasRef = useRef();

  useEffect(() => {
    var model
    var modelLoaded = false;
    var stream;
    var animationId;

    const drawBoxes = (predictions) => {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      predictions.forEach(pred => {
        if (pred.class === 'person' && pred.score > 0.5) {
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 2;
          ctx.strokeRect(...pred.bbox);
          ctx.font = '16px Arial';
          ctx.fillStyle = 'red';
          ctx.fillText(
            `${pred.class} (${(pred.score * 100).toFixed(1)}%)`,
            pred.bbox[0],
            pred.bbox[1] > 20 ? pred.bbox[1] - 5 : 10
          );
        }
      });
    };

    const loadModel = async () => {
      model = await cocoSsd.load();
      modelLoaded = true;
      console.log('Model loaded');
      detectFrame(); // Start detection loop when model is loaded
    }

    const detectFrame = async () => {
      if (videoRef.current && modelLoaded) {
        const predictions = await model.detect(videoRef.current);
        // You can draw predictions here
        // console.log(predictions);
        for (const pred of predictions) {
          console.log(`Detected ${pred.class} with confidence ${pred.score}, bounding box: ${pred.bbox}`);
        }
        drawBoxes(predictions);
      }
      animationId = requestAnimationFrame(detectFrame); // Schedule next frame
    };

    // Request camera access
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((stream) => {
      if (videoRef.current) {
        console.log(stream);
        videoRef.current.srcObject = stream;
        loadModel();
      }
      // detectFrame();
    });

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);
  
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2rem', color: '#1e90ff' }}>Player View</h1>
      <p>This is where players will scan and interact with the game.</p>
     <div style={{ display: 'inline-block', position: 'relative' }}>
        {/* Camera feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          width={640}
          height={480}
          style={{ position: 'absolute', top: 0, left: 0 }}
        />
        {/* Canvas overlay for bounding boxes */}
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{ position: 'absolute', top: 0, left: 0 }}
        />
      </div>
    </div>

  )
}
