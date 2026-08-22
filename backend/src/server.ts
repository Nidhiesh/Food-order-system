import app from './app';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`[Server] running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: any) => {
  console.error('[Unhandled Rejection]:', err.message || err);
  if (err.stack) {
    console.error(err.stack);
  }
});
