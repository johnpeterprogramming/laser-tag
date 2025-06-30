import express from "express";
import cors from "cors";

import dotenv from "dotenv";
dotenv.config();

const port = process.env.PORT || 8080;

const app = express();


var corsOptions = {
  origin: [`http://localhost:${port}`, `http://127.0.0.1:${port}`],
  optionsSuccessStatus: 200, // For legacy browser support
};
app.use(cors(corsOptions));

app.get("/", (req, res) => {
  res.send("Hello from Express with TypeScript!");
});

app.get("/api", (req, res) => {
  res.json({ message: "TEST API IS WORKING!" });
});

app.listen(port, () => {
  console.log(`Server listening at http://0.0.0.0:${port}`);
});
