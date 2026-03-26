import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/error.middleware.js';
import { dbConnect, query } from './config/database.js';
import fs from 'fs/promises';
import path from 'path';
// Run gamification migration if tables missing
async function runGamificationMigration() {
  try {
    await query('SELECT 1 FROM user_positions LIMIT 1;');
    console.log('✅ Gamification tables already exist');
  } catch (err) {
    // Table does not exist, run migration
    console.log('⚡ Running gamification migration...');
    const migrationPath = path.resolve('./src/migrations/community_gamification.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');
    try {
      // Run the entire SQL file in one query so dollar-quoted functions and triggers are preserved
      await query(sql);
    } catch (e) {
      // If the driver or server rejects multiple statements, try a fallback: split by "\n-- " (simple segments)
      if (e.message && e.message.toLowerCase().includes('unterminated dollar-quoted string')) {
        console.error('Migration error (dollar-quote):', e.message);
      } else {
        console.warn('Migration full-run failed, attempting safe statement execution fallback:', e.message);
        const parts = sql.split(/;\s*\n/);
        for (const part of parts) {
          if (part.trim()) {
            try {
              await query(part);
            } catch (innerErr) {
              if (!innerErr.message.includes('already exists')) {
                console.error('Migration error:', innerErr.message);
              }
            }
          }
        }
      }
    }
    console.log('✅ Gamification tables created');
  }
}
// Run employees migration to create municipality employee table if missing
async function runEmployeesMigration() {
  try {
    // quick check if employees table exists
    await query('SELECT 1 FROM employees LIMIT 1;');
    console.log('✅ Employees table already exists');
  } catch (err) {
    console.log('⚡ Running employees migration...');
    const migrationPath = path.resolve('./src/migrations/employees_table.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');
    try {
      await query(sql);
      console.log('✅ Employees table created');
    } catch (e) {
      console.error('Employees migration error:', e.message || e);
      // fallback splitting
      const parts = sql.split(/;\s*\n/);
      for (const part of parts) {
        if (part.trim()) {
          try {
            await query(part);
          } catch (innerErr) {
            if (!innerErr.message.includes('already exists')) {
              console.error('Employees migration inner error:', innerErr.message || innerErr);
            }
          }
        }
      }
    }
  }
}
import reportsRoutes from './routes/reports.routes.js';
// Defer importing blockchain service (it may require optional native deps like ethers)
let blockchain;
import ForumService from './services/forum.service.js';
import UserActivityService from './services/user-activity.service.js';
import './services/cron.service.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import statusRoutes from './routes/status.routes.js';
import userRoutes from './routes/users.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import mlRoutes from './routes/ml.routes.js';
import forumRoutes from './routes/forum.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import userActivityRoutes from './routes/user-activity.routes.js';
import mapRoutes from './routes/map.routes.js';
import communityRoutes from './routes/community.routes.js';
import { gamificationRoutes } from './routes/gamification.routes.js';
import mediaRoutes from './routes/media.routes.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Enhanced debugging middleware with colors and symbols
app.use((req, res, next) => {
  const start = Date.now();
  console.log('\n🚀 Incoming Request');
  console.log('──────────────────────────────────');
  console.log(`📡 ${req.method} ${req.originalUrl}`);
  console.log(`🕒 Time: ${new Date().toISOString()}`);
  console.log(`📍 Base URL: ${req.baseUrl || '/'}`);
  console.log(`🛣️  Path: ${req.path}`);
  
  // Log request body if present
  if (Object.keys(req.body || {}).length > 0) {
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
  }
  
  // Override send to log response
  const oldSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    console.log('\n📤 Response');
    console.log('──────────────────────────────────');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📊 Status: ${res.statusCode}`);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        console.log('📦 Response Data:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('� Response Data:', data);
      }
    }
    console.log('──────────────────────────────────\n');
    oldSend.apply(res, arguments);
  };
  
  next();
});

// Middleware
const corsOptions = {
  origin: function (origin, callback) {
    console.log('🔎 CORS Request');
    console.log('──────────────────────────────────');
    console.log('� Origin:', origin);
    console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      // Add your production domain here when ready
    ];
    
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      console.log('✅ Allowing request with no origin');
      return callback(null, true);
    }

    // Development mode - only allow localhost variants
    if (process.env.NODE_ENV === 'development') {
      const lower = origin.toLowerCase();
      if (lower.includes('localhost') || lower.includes('127.0.0.1')) {
        console.log('✅ Development mode: Allowing localhost origin');
        return callback(null, true);
      }
    }

    // Production mode - strict origin checking
    if (allowedOrigins.includes(origin)) {
      console.log('✅ Production mode: Origin allowed');
      return callback(null, true);
    }

    // Reject all other origins
    console.log('❌ Origin rejected');
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // Do not restrict allowed headers here so preflight can accept requested headers
  // (Leaving this unspecified lets the cors middleware echo Access-Control-Request-Headers)
  exposedHeaders: ['Content-Length', 'Content-Type']
};

app.use(cors(corsOptions));

// Body parsing middleware with error handling
app.use(express.json({
  limit: process.env.JSON_BODY_LIMIT || '10mb',
  verify: (req, _res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      // Throw an error with status so the centralized error handler can produce a single response.
      const err = new Error('Invalid JSON in request body');
      err.status = 400;
      err.originalError = e.message;
      throw err;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '10mb' }));

// Routes
app.get('/', (req, res) => {
  res.json({
    name: 'Chhattisgarh Suraksha API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/auth',
      status: '/api/status',
      users: '/api/users',
      metrics: '/api/metrics',
      ml: '/api/ml',
      reports: '/api/reports',
      forum: '/api/forum',
      analytics: '/api/analytics'
    }
  });
});


app.use('/api/auth', authRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/users', userActivityRoutes); // User activity routes (stats, activity, leaderboard)
app.use('/api/users', userRoutes); // User profile routes
app.use('/api/metrics', metricsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/map', mapRoutes); // Interactive map routes
app.use('/api/gamification', gamificationRoutes); // Gamification and achievements routes
app.use('/api/media', mediaRoutes);

// Catch-all route for debugging
app.use((req, res) => {
  console.log('\n⚠️ 404 - Route not found:', req.originalUrl);
  res.status(404).json({
    message: 'Route not found',
    requestedPath: req.originalUrl,
    availableEndpoints: {
      auth: [
        '/api/auth/send-otp',
        '/api/auth/verify-otp',
        '/api/auth/register'
      ],
      status: ['/api/status'],
      users: ['/api/users/profile'],
      metrics: [
        '/api/metrics/current',
        '/api/metrics/alerts'
      ]
    },
    docs: 'Visit /api-docs for complete API documentation'
  });
});

// Error handling
app.use(errorHandler);

// Connect to database and start server
const PORT = process.env.PORT || 5000;

import http from 'http';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

dbConnect().then(async () => {
  console.log('✅ Database connected');

  // Initialize database tables
  try {
    await ForumService.initialize();
    await UserActivityService.createTables();
    await runGamificationMigration();
    await runEmployeesMigration();
  } catch (err) {
    console.error('⚠️ Table initialization warning:', err.message);
  }

  const server = http.createServer(app);
  
  // Create WebSocket server attached to the HTTP server
  const wss = new WebSocketServer({ server, path: '/api/ws' });

  // WebSocket connection handler
  wss.on('connection', async (ws, req) => {
    console.log('👥 New WebSocket connection');

    // Extract token from query string
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    // Verify token and get user ID
    let userId;
    try {
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        userId = decoded.id;
        console.log('🔑 Authenticated WebSocket connection for user:', userId);
        // register with central broadcaster
        try {
          // lazy import to avoid circular issues when this file is required elsewhere
          const { registerClient } = await import('./services/ws-broadcaster.js');
          registerClient(userId, ws);
        } catch (impErr) {
          console.warn('Could not register ws client with broadcaster:', impErr?.message || impErr);
          // Still allow the connection to proceed but it won't receive broadcasts
        }
      }
    } catch (err) {
      console.warn('⚠️ Invalid token in WebSocket connection:', err.message);
      ws.close(4001, 'Unauthorized');
      return;
    }

    // Handle messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        console.log('📩 Received message:', data);
      } catch (err) {
        console.error('❌ Error handling message:', err);
      }
    });

    // Handle client disconnection
    ws.on('close', async () => {
      console.log('🚪 Client disconnected');
      if (userId) {
        try {
          const { removeClient } = await import('./services/ws-broadcaster.js');
          removeClient(userId);
        } catch (e) {
          console.warn('Failed to remove WS client from broadcaster:', e?.message || e);
        }
      }
    });

    // Send initial connection success message
    ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connection established' }));
  });

  // Start server first
  server.listen(PORT, '0.0.0.0', async () => {
    const address = server.address();
    console.log(`🚀 Server is running on ${typeof address === 'string' ? address : `${address.address}:${address.port}`}`);
    console.log('🔌 WebSocket server is listening on /api/ws');
    
    // Then try to initialize blockchain (lazy import so missing optional deps don't crash startup)
    try {
      console.log('Initializing blockchain...');
      blockchain = await import('./services/blockchain.service.js');
      const contractAddress = await blockchain.initBlockchain();
      console.log('✅ Blockchain contract deployed at:', contractAddress);
    } catch (err) {
      console.error('⚠️ Blockchain initialization failed or optional deps missing:', err.message);
      console.log('👉 Blockchain features disabled for now. To enable, install optional deps and run a local node.');
      // Don't exit - let the server run without blockchain for development
    }
  });

  server.on('error', (error) => {
    console.error('Server error:', error);
  });
}).catch(err => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});