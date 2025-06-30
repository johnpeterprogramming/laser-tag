import express from "express";
import cors from "cors";

const app = express();

const port = 8080; // Choose a port different from React's default (3000)
var corsOptions = {
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
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
