require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me') {
  console.error('Set a strong JWT_SECRET in your .env file before starting.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/meta', require('./src/routes/meta'));
app.use('/api/verification', require('./src/routes/verification'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/profile', require('./src/routes/profile'));
app.use('/api/mentors', require('./src/routes/mentors'));
app.use('/api/problems', require('./src/routes/problems'));
app.use('/api/requests', require('./src/routes/requests'));
app.use('/api/sessions', require('./src/routes/sessions'));
app.use('/api/reviews', require('./src/routes/reviews'));
app.use('/api/credits', require('./src/routes/credits'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/reports', require('./src/routes/reports'));
app.use('/api/blocks', require('./src/routes/blocks'));
app.use('/api/moderation', require('./src/routes/moderation'));
app.use('/api', require('./src/routes/directory'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use(express.static(path.join(__dirname, 'public')));

// Central error handler: never leak internals to the client
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Student Assist running at http://localhost:${port}`));

