// index.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const normalizeRoutes = require('./routes/normalize');
const communityRoutes = require('./routes/community');
const schemaRoutes = require('./routes/schema');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/normalize', normalizeRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/schema', schemaRoutes);

const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
  res.send('Normalization Visualizer Backend is running');
});
app.listen(PORT, () => {
  console.log(`Normalization backend listening on http://localhost:${PORT}`);
});

