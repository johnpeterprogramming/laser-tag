import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

const port = 5000; // Choose a port different from React's default (3000)

app.get('/', (req, res) => {
  res.send('Hello from Express with TypeScript!');
});

app.get('/api', (req, res) => {
  res.json({ message: 'TEST API IS WORKING!' });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});